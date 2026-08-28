import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getSessionTeacher } from "@/lib/auth/teacher";

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

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("processing_jobs")
    .select("id, status, total_count, completed_count, failed_count, current_step, created_at")
    .eq("id", jobId)
    .maybeSingle();

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
