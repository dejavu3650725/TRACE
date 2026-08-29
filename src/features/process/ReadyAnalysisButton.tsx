"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

export function ReadyAnalysisButton({ submissionIds }: { submissionIds: string[] }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (running || submissionIds.length === 0) return;
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/process/analysis-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_ids: submissionIds }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        data: { job_id: string } | null;
        error: { message: string } | null;
      };
      if (!result.ok || !result.data) throw new Error(result.error?.message ?? "분석을 시작하지 못했어요.");
      router.push(`/analysis/jobs/${result.data.job_id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "분석을 시작하지 못했어요.");
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {error ? <span role="alert" className="text-xs font-semibold text-danger">{error}</span> : null}
      <button
        type="button"
        onClick={run}
        disabled={running || submissionIds.length === 0}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4" />
        {running ? "분석 시작 중..." : `${submissionIds.length}건 분석 시작`}
      </button>
    </div>
  );
}
