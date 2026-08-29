"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { ProgressPanel } from "@/components/ui/ProgressPanel";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  isProcessingJobActive,
  isProcessingJobTerminal,
  type ProcessingJobStatus,
} from "./job-state";

interface JobState {
  status: ProcessingJobStatus;
  total_count: number;
  completed_count: number;
  failed_count: number;
  current_step: string | null;
  error_message: string | null;
  updated_at: string;
}

/** processing_jobs 폴링 (2초 간격, 완료 시 중단) — TRD §28 */
export function JobProgress({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let consecutiveFailures = 0;

    const retryOrFail = (message: string) => {
      consecutiveFailures += 1;
      if (consecutiveFailures <= 3) {
        timer = setTimeout(poll, 2000);
      } else {
        setError(message);
      }
    };

    async function poll() {
      try {
        const res = await fetch(`/api/process/analysis-jobs/${jobId}`, { cache: "no-store" });
        const json = (await res.json()) as {
          ok: boolean;
          data: JobState | null;
          error: { message: string } | null;
        };
        if (stopped) return;
        if (!json.ok || !json.data) {
          if (res.status === 401 || res.status === 400 || res.status === 404) {
            setError(json.error?.message ?? "작업 상태를 불러오지 못했어요.");
          } else {
            retryOrFail(json.error?.message ?? "작업 상태를 불러오지 못했어요.");
          }
          return;
        }
        consecutiveFailures = 0;
        setError(null);
        setJob(json.data);
        if (isProcessingJobActive(json.data.status)) {
          timer = setTimeout(poll, 2000);
        }
      } catch {
        if (!stopped) retryOrFail("작업 상태를 불러오지 못했어요.");
      }
    }

    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  if (error) return <ErrorState description={error} onRetry={() => location.reload()} />;

  const done = job && isProcessingJobTerminal(job.status);
  const failed = job?.status === "FAILED";
  const reviewRequired = job?.status === "REVIEW_REQUIRED";
  const FinalIcon = failed ? XCircle : reviewRequired ? ClipboardCheck : CheckCircle2;

  return (
    <div className="space-y-5">
      <ProgressPanel
        title="AI 분석"
        currentStep={
          job?.current_step ??
          (job?.status === "COMPLETED"
            ? "분석 완료"
            : job?.status === "FAILED"
              ? "분석 실패"
              : job?.status === "REVIEW_REQUIRED"
                ? "교사 검토 대기"
              : "작업 확인 중...")
        }
        total={job?.total_count ?? 0}
        completed={job?.completed_count ?? 0}
        failed={job?.failed_count ?? 0}
      />

      {job ? <p className="text-right text-xs text-muted">최근 갱신 {new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(job.updated_at))}</p> : null}

      {done && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
          <FinalIcon className={`h-8 w-8 ${failed ? "text-danger" : "text-success"}`} />
          <p className="font-bold text-foreground">
            {failed ? "분석을 완료하지 못했어요" : reviewRequired ? "분석이 끝나 검토할 수 있어요" : "작업을 완료했어요"}
          </p>
          <p className="text-sm text-foreground">
            완료 <b className="text-success">{job.completed_count}</b>건
            {job.failed_count > 0 && (
              <>
                {" "}
                · 실패 <b className="text-danger">{job.failed_count}</b>건
                {job.error_message && (
                  <span className="mt-1 block break-all rounded-lg bg-danger-bg px-3 py-2 text-left text-xs text-danger">
                    최근 오류: {job.error_message}
                  </span>
                )}
                <span className="block text-xs text-muted">
                  실패한 자료는 다시 선택해 재실행할 수 있어요.
                </span>
              </>
            )}
          </p>
          <Link
            href={failed ? "/results" : "/analysis"}
            className="mt-1 inline-flex items-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-700"
          >
            {failed ? "분석 대상 다시 선택" : "검토하러 가기"}
          </Link>
        </div>
      )}
    </div>
  );
}
