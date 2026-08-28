import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getSessionTeacher } from "@/lib/auth/teacher";
import { analyzeOneSubmission } from "@/features/process/run";

export const maxDuration = 60;

/**
 * POST /api/process/analysis-jobs (TRD §28)
 * Body: { submission_ids: string[] }
 * - processing_jobs Row 생성 → 순차 분석 → 진행상태 갱신
 * - 한 학생 실패가 Batch 전체 실패가 되지 않는다 (Partial Success)
 * - 응답은 공통 Envelope { ok, data, meta, error } (TRD §29)
 */
export async function POST(request: Request) {
  const requestId = `REQ-${randomUUID().slice(0, 8)}`;
  const envelope = (
    status: number,
    data: unknown,
    error: { code: string; message: string } | null = null,
  ) =>
    NextResponse.json(
      { ok: !error, data: error ? null : data, meta: { request_id: requestId }, error },
      { status },
    );

  const { userId, teacher } = await getSessionTeacher();
  if (!userId || !teacher) {
    return envelope(401, null, { code: "UNAUTHORIZED", message: "로그인이 필요합니다." });
  }

  let submissionIds: string[];
  try {
    const body = (await request.json()) as { submission_ids?: unknown };
    submissionIds = Array.isArray(body.submission_ids)
      ? body.submission_ids.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    submissionIds = [];
  }
  if (submissionIds.length === 0 || submissionIds.length > 30) {
    return envelope(400, null, {
      code: "INVALID_INPUT",
      message: "분석할 제출물을 1~30개 선택해 주세요.",
    });
  }

  const supabase = await createClient();

  // Server Ownership Check (TRD §30.3) — RLS 범위에서 실제 조회되는 수와 비교
  const { data: owned } = await supabase
    .from("submissions")
    .select("id")
    .in("id", submissionIds);
  const ownedIds = new Set((owned ?? []).map((s) => s.id));
  if (ownedIds.size !== submissionIds.length) {
    return envelope(403, null, {
      code: "FORBIDDEN",
      message: "요청한 제출물 중 접근할 수 없는 항목이 있습니다.",
    });
  }

  // Job 생성 (TRD §16.15) — payload에는 최소 ID만 (Full Payload 금지)
  const { data: job, error: jobError } = await supabase
    .from("processing_jobs")
    .insert({
      teacher_id: teacher.id,
      job_type: "ANALYSIS",
      status: "PROCESSING",
      total_count: submissionIds.length,
      payload_json: { submission_ids: submissionIds },
    })
    .select("id")
    .single();
  if (jobError || !job) {
    return envelope(500, null, { code: "JOB_CREATE_FAILED", message: "작업 생성에 실패했습니다." });
  }

  // Audit Log (TRD §16.14) — PII/답안 전문 저장 금지
  await supabase.from("audit_logs").insert({
    actor_teacher_id: teacher.id,
    action: "ANALYSIS_START",
    entity_type: "processing_job",
    entity_id: job.id,
    request_id: requestId,
    metadata_json: { submission_count: submissionIds.length },
  });

  // 순차 분석 — 부분 실패 허용
  let completed = 0;
  let failed = 0;
  for (const submissionId of submissionIds) {
    try {
      await analyzeOneSubmission(supabase, submissionId);
      completed += 1;
    } catch {
      failed += 1;
    }
    await supabase
      .from("processing_jobs")
      .update({
        completed_count: completed,
        failed_count: failed,
        current_step: `${completed + failed}/${submissionIds.length} 처리`,
      })
      .eq("id", job.id);
  }

  await supabase
    .from("processing_jobs")
    .update({
      status: failed === submissionIds.length ? "FAILED" : "COMPLETED",
      current_step: null,
    })
    .eq("id", job.id);

  return envelope(200, { job_id: job.id, completed, failed, total: submissionIds.length });
}
