"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ProgressPanel } from "@/components/ui/ProgressPanel";
import { ErrorState } from "@/components/ui/ErrorState";

interface JobState {
  status: "QUEUED" | "PROCESSING" | "REVIEW_REQUIRED" | "COMPLETED" | "FAILED";
  total_count: number;
  completed_count: number;
  failed_count: number;
  current_step: string | null;
}

/** processing_jobs 폴링 (2초 간격, 완료 시 중단) — TRD §28 */
export function JobProgress({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/process/analysis-jobs/${jobId}`, { cache: "no-store" });
        const json = (await res.json()) as {
          ok: boolean;
          data: JobState | null;
          error: { message: string } | null;
        };
        if (stopped) return;
        if (!json.ok || !json.data) {
          setError(json.error?.message ?? "작업 상태를 불러오지 못했어요.");
          return;
        }
        setJob(json.data);
        if (json.data.status === "PROCESSING" || json.data.status === "QUEUED") {
          setTimeout(poll, 2000);
        }
      } catch {
        if (!stopped) setError("작업 상태를 불러오지 못했어요.");
      }
    };

    poll();
    return () => {
      stopped = true;
    };
  }, [jobId]);

  if (error) return <ErrorState description={error} onRetry={() => location.reload()} />;

  const done = job && (job.status === "COMPLETED" || job.status === "FAILED");

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
              : "작업 확인 중...")
        }
        total={job?.total_count ?? 0}
        completed={job?.completed_count ?? 0}
        failed={job?.failed_count ?? 0}
      />

      {done && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
          <CheckCircle2 className="h-8 w-8 text-success" />
          <p className="text-sm text-foreground">
            완료 <b className="text-success">{job.completed_count}</b>건
            {job.failed_count > 0 && (
              <>
                {" "}
                · 실패 <b className="text-danger">{job.failed_count}</b>건
                <span className="block text-xs text-muted">
                  실패한 자료는 학습관리에서 상태를 확인한 뒤 다시 실행할 수 있어요.
                </span>
              </>
            )}
          </p>
          <Link
            href="/analysis"
            className="mt-1 inline-flex items-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-700"
          >
            검토하러 가기
          </Link>
        </div>
      )}
    </div>
  );
}
