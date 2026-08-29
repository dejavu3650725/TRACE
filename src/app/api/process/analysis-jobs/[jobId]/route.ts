import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionTeacher } from "@/lib/auth/teacher";

const jobIdSchema = z.string().uuid();

/**
 * GET /api/process/analysis-jobs/[jobId] (TRD §28, §44)
 * Job 진행상태 조회 — 페이지 이동/새로고침 후에도 job_id로 재조회 가능.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const requestId = `REQ-${randomUUID().slice(0, 8)}`;
  const { jobId } = await params;

  const { userId } = await getSessionTeacher();
  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        data: null,
        meta: { request_id: requestId },
        error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
      },
      { status: 401 },
    );
  }

  if (!jobIdSchema.safeParse(jobId).success) {
    return NextResponse.json(
      {
        ok: false,
        data: null,
        meta: { request_id: requestId },
        error: { code: "INVALID_INPUT", message: "작업 ID를 다시 확인해 주세요." },
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: job, error: jobError } = await supabase
    .from("processing_jobs")
    .select(
      "id, job_type, status, total_count, completed_count, failed_count, current_step, error_message, created_at, updated_at",
    )
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) {
    console.error(`Processing Job lookup failed [${jobError.code}]`);
    return NextResponse.json(
      {
        ok: false,
        data: null,
        meta: { request_id: requestId },
        error: { code: "JOB_LOOKUP_FAILED", message: "작업 상태를 불러오지 못했어요." },
      },
      { status: 500 },
    );
  }

  if (!job) {
    return NextResponse.json(
      {
        ok: false,
        data: null,
        meta: { request_id: requestId },
        error: { code: "NOT_FOUND", message: "작업을 찾을 수 없습니다." },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: job,
    meta: { request_id: requestId },
    error: null,
  });
}
