import { NextRequest, NextResponse } from "next/server";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { buildStructuredInput, deriveQuestionIds } from "@/lib/input/result-spreadsheet";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * ISSUE-22 — 교사 확정 후 실제 DB Commit
 * 각 행: Roster 재검증 → get_or_create_submission RPC → structured_input 저장 → READY_FOR_PROCESS
 * 알 수 없는 학생을 조용히 만들지 않는다.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    assignment_id?: string;
    rows?: Array<{ student_number: number; student_name: string; answers: Record<string, string> }>;
  } | null;
  const assignmentId = String(body?.assignment_id ?? "");
  const rows = Array.isArray(body?.rows) ? body!.rows : [];
  if (!assignmentId || rows.length === 0) {
    return NextResponse.json({ error: "가져올 행이 없어요." }, { status: 400 });
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

  const { data: students } = await supabase
    .from("students")
    .select("id, student_number, name")
    .eq("class_id", assignment.class_id);
  const rosterByNumber = new Map((students ?? []).map((s) => [s.student_number, s]));

  let saved = 0;
  const failures: Array<{ student_number: number; reason: string }> = [];
  for (const row of rows) {
    const student = rosterByNumber.get(row.student_number);
    if (!student || student.name !== row.student_name) {
      failures.push({ student_number: row.student_number, reason: "명렬 불일치" });
      continue;
    }
    const { data: submissionId, error: rpcError } = await supabase.rpc("get_or_create_submission", {
      p_student_id: student.id,
      p_activity_assignment_id: assignmentId,
    });
    if (rpcError || !submissionId) {
      failures.push({ student_number: row.student_number, reason: "제출 생성 실패" });
      continue;
    }
    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        structured_input: buildStructuredInput(questionIds, row.answers),
        input_status: "READY_FOR_PROCESS",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", submissionId);
    if (updateError) {
      failures.push({ student_number: row.student_number, reason: "저장 실패" });
      continue;
    }
    saved += 1;
  }

  return NextResponse.json({ ok: true, saved, failures });
}
