import { NextResponse } from "next/server";
import { after } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getSessionTeacher } from "@/lib/auth/teacher";
import { analyzeOneSubmission } from "@/features/process/run";

export const maxDuration = 300;

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

  // 백그라운드 병렬 분석 (TRD §28) — 응답은 즉시 반환하고, 분석은 응답 후 서버에서 계속된다.
  // 교사는 다른 화면으로 이동해도 되고, 진행상태는 job_id 폴링으로 확인한다.
  after(async () => {
    const CONCURRENCY = 5; // Gemini 무료 등급 분당 한도 고려
    let completed = 0;
    let failed = 0;
    let lastError: string | null = null;
    let cursor = 0;

    const worker = async () => {
      while (true) {
        const i = cursor++;
        if (i >= submissionIds.length) return;
        try {
          await analyzeOneSubmission(supabase, submissionIds[i]);
          completed += 1;
        } catch (e) {
          failed += 1;
          lastError = e instanceof Error ? e.message.slice(0, 500) : "알 수 없는 오류";
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
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, submissionIds.length) }, () => worker()),
    );

    await supabase
      .from("processing_jobs")
      .update({
        status: failed === submissionIds.length ? "FAILED" : "COMPLETED",
        current_step: null,
        error_message: lastError,
      })
      .eq("id", job.id);
  });

  return envelope(200, { job_id: job.id, total: submissionIds.length });
}
