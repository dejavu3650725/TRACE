import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeOneSubmission } from "@/features/process/run";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * ISSUE-19 — 제출 완료 확정 + 즉시 자동 AI 분석
 * 사진이 1장 이상 업로드된 Submission만 READY_FOR_PROCESS로 전환하고,
 * 응답 반환 직후 서버에서 바로 분석을 시작한다 (교사는 검토 대기에서 초안을 받는다).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const submissionId = String(body?.submission_id ?? "");
  const sessionCode = String(body?.session_code ?? "");
  if (!submissionId || !sessionCode) {
    return NextResponse.json({ ok: false, message: "잘못된 요청이에요." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: submission } = await supabase
    .from("submissions")
    .select(
      "id, submission_code, current_attempt_no, activity_assignments ( status, classes ( teacher_id ) )",
    )
    .eq("id", submissionId)
    .maybeSingle();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  const assignment = submission ? one(submission.activity_assignments) : null;
  if (!submission || submission.submission_code !== sessionCode || assignment?.status !== "OPEN") {
    return NextResponse.json({ ok: false, message: "제출 세션이 만료됐어요." }, { status: 403 });
  }
  const teacherId = one(assignment?.classes)?.teacher_id as string | undefined;

  const { count } = await supabase
    .from("artifacts")
    .select("id", { count: "exact", head: true })
    .eq("submission_id", submissionId)
    .eq("artifact_role", "ORIGINAL")
    .eq("attempt_no", submission.current_attempt_no ?? 1);
  if (!count) {
    return NextResponse.json({ ok: false, message: "업로드된 사진이 없어요." }, { status: 400 });
  }

  const { error } = await supabase
    .from("submissions")
    .update({
      input_status: "READY_FOR_PROCESS",
      submitted_at: new Date().toISOString(),
      // 사진 제출이 최신 근거가 되므로 예전 구조화 응답(시드/스프레드시트)은 비운다
      structured_input: null,
    })
    .eq("id", submissionId);
  if (error) {
    return NextResponse.json({ ok: false, message: "제출 확정에 실패했어요." }, { status: 500 });
  }

  // ── 제출 즉시 자동 AI 분석 (응답 반환 후 백그라운드) ──
  // 학생은 기다리지 않고, 교사는 검토 대기에서 AI 초안을 받는다. 실패해도 제출은 유효하며
  // 교사가 평가관리에서 다시 [분석 실행]을 누를 수 있다.
  if (teacherId) {
    after(async () => {
      const { data: job } = await supabase
        .from("processing_jobs")
        .insert({
          teacher_id: teacherId,
          job_type: "ANALYSIS",
          status: "PROCESSING",
          total_count: 1,
          payload_json: { submission_ids: [submissionId], trigger: "student_submit" },
        })
        .select("id")
        .single();
      let failed = false;
      let lastError: string | null = null;
      try {
        await analyzeOneSubmission(supabase, submissionId);
      } catch (e) {
        failed = true;
        lastError = e instanceof Error ? e.message.slice(0, 500) : "알 수 없는 오류";
        console.error("[student-submit] auto analysis failed", lastError);
      }
      if (job) {
        await supabase
          .from("processing_jobs")
          .update({
            status: failed ? "FAILED" : "COMPLETED",
            completed_count: failed ? 0 : 1,
            failed_count: failed ? 1 : 0,
            error_message: lastError,
          })
          .eq("id", job.id);
      }
    });
  }

  return NextResponse.json({ ok: true, page_count: count });
}
