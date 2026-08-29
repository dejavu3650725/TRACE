import { NextResponse } from "next/server";
import { after } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionTeacher } from "@/lib/auth/teacher";
import { ProcessHandoffContractError } from "@/features/process/handoff-contract";
import { resolveProcessHandoff } from "@/features/process/handoff";
import { analysisJobFinalStatus, safeProcessingJobErrorMessage } from "@/features/process/job-state";
import { analyzeOneSubmission } from "@/features/process/run";

export const maxDuration = 300;

const analysisJobRequestSchema = z.object({
  submission_ids: z.array(z.string().uuid()).min(1).max(30),
}).strict();

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

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    requestBody = null;
  }
  const parsed = analysisJobRequestSchema.safeParse(requestBody);
  if (!parsed.success || new Set(parsed.data.submission_ids).size !== parsed.data.submission_ids.length) {
    return envelope(400, null, {
      code: "INVALID_INPUT",
      message: "분석할 제출물을 1~30개 선택해 주세요.",
    });
  }
  const submissionIds = parsed.data.submission_ids;

  const supabase = await createClient();

  // PROCESS resolves every relation from IDs in Shared DB; the request carries no copied payload.
  let handoffContexts;
  try {
    handoffContexts = await resolveProcessHandoff(supabase, teacher.id, submissionIds);
  } catch (error) {
    if (error instanceof ProcessHandoffContractError) {
      if (error.code === "FORBIDDEN") {
        return envelope(403, null, {
          code: "FORBIDDEN",
          message: "요청한 제출물 중 접근할 수 없는 항목이 있습니다.",
        });
      }
      if (error.code === "NOT_READY") {
        return envelope(409, null, {
          code: "NOT_READY",
          message: "분석 준비가 완료되지 않은 제출물이 포함되어 있어요. 학습관리에서 다시 확인해 주세요.",
        });
      }
    }
    console.error("PROCESS handoff resolution failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return envelope(500, null, {
      code: "HANDOFF_FAILED",
      message: "분석 대상을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
    });
  }
  const handoffBySubmission = new Map(
    handoffContexts.map((context) => [context.submissionId, context]),
  );

  // Job 생성 (TRD §16.15) — payload에는 최소 ID만 (Full Payload 금지)
  const { data: job, error: jobError } = await supabase
    .from("processing_jobs")
    .insert({
      teacher_id: teacher.id,
      job_type: "ANALYSIS",
      status: "QUEUED",
      total_count: submissionIds.length,
      completed_count: 0,
      failed_count: 0,
      current_step: "분석 대기 중",
      payload_json: { submission_ids: submissionIds },
    })
    .select("id")
    .single();
  if (jobError || !job) {
    return envelope(500, null, { code: "JOB_CREATE_FAILED", message: "작업 생성에 실패했습니다." });
  }

  // Audit Log (TRD §16.14) — 0004 이후 직접 INSERT 금지, 고정형 RPC 사용 (0005)
  await supabase.rpc("record_analysis_event", {
    p_action: "ANALYSIS_START",
    p_entity_type: "processing_job",
    p_entity_id: job.id,
    p_request_id: requestId,
  });

  // 백그라운드 병렬 분석 (TRD §28) — 응답은 즉시 반환하고, 분석은 응답 후 서버에서 계속된다.
  // 교사는 다른 화면으로 이동해도 되고, 진행상태는 job_id 폴링으로 확인한다.
  after(async () => {
    const CONCURRENCY = 5; // Gemini 무료 등급 분당 한도 고려
    let completed = 0;
    let failed = 0;
    let cursor = 0;
    let progressWrite = Promise.resolve();

    const { error: startError } = await supabase
      .from("processing_jobs")
      .update({ status: "PROCESSING", current_step: `0/${submissionIds.length} 분석 중` })
      .eq("id", job.id);
    if (startError) console.error(`Processing Job start update failed [${startError.code}]`);

    const persistProgress = () => {
      const snapshot = { completed, failed, attempted: completed + failed };
      progressWrite = progressWrite.then(async () => {
        const { error: progressError } = await supabase
          .from("processing_jobs")
          .update({
            completed_count: snapshot.completed,
            failed_count: snapshot.failed,
            current_step: `${snapshot.attempted}/${submissionIds.length} 분석 중`,
          })
          .eq("id", job.id);
        if (progressError) console.error(`Processing Job progress update failed [${progressError.code}]`);
      });
      return progressWrite;
    };

    const worker = async () => {
      while (true) {
        const i = cursor++;
        if (i >= submissionIds.length) return;
        try {
          await analyzeOneSubmission(
            supabase,
            submissionIds[i],
            handoffBySubmission.get(submissionIds[i])?.artifacts,
          );
          completed += 1;
        } catch (e) {
          failed += 1;
          console.error("PROCESS item failed", {
            errorType: e instanceof Error ? e.name : "UnknownError",
          });
        }
        await persistProgress();
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, submissionIds.length) }, () => worker()),
    );
    await progressWrite;

    const finalStatus = analysisJobFinalStatus(completed, failed);
    const { error: finalError } = await supabase
      .from("processing_jobs")
      .update({
        status: finalStatus,
        completed_count: completed,
        failed_count: failed,
        current_step: finalStatus === "FAILED"
          ? "분석에 실패했어요"
          : `분석 ${completed}건 완료 · 교사 검토 대기`,
        error_message: safeProcessingJobErrorMessage(failed),
      })
      .eq("id", job.id);
    if (finalError) console.error(`Processing Job final update failed [${finalError.code}]`);
  });

  return envelope(200, { job_id: job.id, total: submissionIds.length });
}
