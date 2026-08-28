import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { deriveQuestionIds, FIXED_HEADERS } from "@/lib/input/result-spreadsheet";

export const runtime = "nodejs";

/**
 * ISSUE-21 — 학생 결과 표준 템플릿 다운로드 (선택한 ActivityAssignment 기준)
 * 컬럼: student_number | student_name | 활동 문항 Q1..Qn
 * Roster를 행으로 미리 채워 배부 — 학급명 컬럼 없음 (Assignment가 Class를 결정).
 */
export async function GET(req: NextRequest) {
  const assignmentId = req.nextUrl.searchParams.get("assignmentId") ?? "";
  if (!assignmentId) {
    return NextResponse.json({ error: "assignmentId가 필요해요." }, { status: 400 });
  }

  const { supabase } = await requireSessionTeacher();
  const { data: assignment } = await supabase
    .from("activity_assignments")
    .select("id, class_id, activities ( title, content_json ), classes ( name )")
    .eq("id", assignmentId)
    .maybeSingle();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  const activity = assignment ? one(assignment.activities) : null;
  if (!assignment || !activity) {
    return NextResponse.json({ error: "배정을 찾을 수 없어요." }, { status: 404 });
  }

  const questionIds = deriveQuestionIds(activity.content_json);
  const { data: students } = await supabase
    .from("students")
    .select("student_number, name")
    .eq("class_id", assignment.class_id)
    .order("student_number", { ascending: true });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("결과");
  const headers = [...FIXED_HEADERS, ...questionIds];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = headers.map((h, i) => ({
    width: i === 1 ? 14 : i === 0 ? 14 : 30,
  }));
  for (const s of students ?? []) {
    sheet.addRow([s.student_number, s.name, ...questionIds.map(() => "")]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const className = one(assignment.classes)?.name ?? "class";
  const fileName = encodeURIComponent(`TRACE_결과템플릿_${className}.xlsx`);
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
    },
  });
}
