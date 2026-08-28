import { NextRequest, NextResponse } from "next/server";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { FILE_LIMITS } from "@/lib/config";
import {
  deriveQuestionIds,
  parseResultFile,
  validateHeaders,
} from "@/lib/input/result-spreadsheet";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ISSUE-22 — 결과 스프레드시트 검증·파싱·Roster 매칭 (Preview 단계, DB 변경 없음)
 * - 파일 크기(10MB)/표준 header 검증 — 임의 header 매핑 금지
 * - 번호+이름으로 Roster 정확 일치, 유효/오류 행을 명확히 분리해 반환
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const assignmentId = String(form?.get("assignmentId") ?? "");
  const file = form?.get("file");
  if (!form || !assignmentId || !(file instanceof File)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (file.size > FILE_LIMITS.SPREADSHEET_MAX_BYTES) {
    return NextResponse.json({ error: "파일은 10MB 이하 CSV/XLSX만 가져올 수 있어요." }, { status: 400 });
  }
  if (!/\.(csv|xlsx)$/i.test(file.name)) {
    return NextResponse.json({ error: "CSV 또는 XLSX 파일만 지원해요." }, { status: 400 });
  }

  const { supabase } = await requireSessionTeacher();
  const { data: assignment } = await supabase
    .from("activity_assignments")
    .select("id, class_id, activities ( content_json )")
    .eq("id", assignmentId)
    .maybeSingle();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  if (!assignment) {
    return NextResponse.json({ error: "배정을 찾을 수 없어요." }, { status: 404 });
  }

  const questionIds = deriveQuestionIds(one(assignment.activities)?.content_json);
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseResultFile(file.name, buffer, questionIds);

  const headerError = validateHeaders(parsed.headers, questionIds);
  if (headerError) {
    return NextResponse.json({ error: headerError }, { status: 422 });
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, student_number, name")
    .eq("class_id", assignment.class_id);
  const rosterByNumber = new Map((students ?? []).map((s) => [s.student_number, s]));

  const rows = parsed.rows.map((row) => {
    let error: string | null = null;
    if (row.studentNumber === null) error = "번호가 비어 있거나 숫자가 아니에요";
    else if (!row.studentName) error = "이름이 비어 있어요";
    else {
      const match = rosterByNumber.get(row.studentNumber);
      if (!match) error = "학급 명렬에 없는 번호예요";
      else if (match.name !== row.studentName) error = "번호와 이름이 명렬과 일치하지 않아요";
    }
    if (!error && questionIds.every((q) => !row.answers[q])) {
      error = "응답이 모두 비어 있어요";
    }
    return { ...row, error };
  });

  return NextResponse.json({
    question_ids: questionIds,
    valid: rows.filter((r) => !r.error),
    invalid: rows.filter((r) => r.error),
  });
}
