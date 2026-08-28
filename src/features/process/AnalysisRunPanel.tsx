"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PROCESS_STATUS_LABEL, type ProcessStatus } from "@/shared/types/status";

export interface AnalysisTargetRow {
  id: string;
  studentLabel: string;
  activityTitle: string;
  standardIds: string[];
  processStatus: ProcessStatus;
}

/**
 * 분석 대상 선택 + 실행 패널 (TRD §43)
 * 선택된 submission_id[]만 API로 전달한다 (Full Payload 복제 금지, TRD §22).
 */
export function AnalysisRunPanel({ rows }: { rows: AnalysisTargetRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="분석할 수 있는 자료가 없어요"
        description="학습관리에서 자료가 '분석 준비' 상태가 되면 여기에 표시돼요."
        ctaLabel="학습관리로 이동"
        ctaHref="/results"
      />
    );
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  };

  const run = async () => {
    if (selected.size === 0 || running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/process/analysis-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_ids: Array.from(selected) }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data: { job_id: string } | null;
        error: { message: string } | null;
      };
      if (!json.ok || !json.data) throw new Error(json.error?.message ?? "분석 실행에 실패했어요.");
      router.push(`/analysis/jobs/${json.data.job_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 실행에 실패했어요.");
      setRunning(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-neutral-bg/80 backdrop-blur">
            <tr className="border-b border-line">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === rows.length && rows.length > 0}
                  onChange={toggleAll}
                  className="h-4 w-4 accent-brand-600"
                  aria-label="전체 선택"
                />
              </th>
              <th className="px-2 py-3 text-xs font-semibold text-muted">학생</th>
              <th className="px-2 py-3 text-xs font-semibold text-muted">활동</th>
              <th className="px-2 py-3 text-xs font-semibold text-muted">성취기준</th>
              <th className="px-2 py-3 text-xs font-semibold text-muted">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => toggle(row.id)}
                className="cursor-pointer border-b border-line/60 transition-colors duration-150 last:border-b-0 hover:bg-brand-50/40"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 accent-brand-600"
                  />
                </td>
                <td className="px-2 py-3 font-semibold text-foreground">{row.studentLabel}</td>
                <td className="px-2 py-3 text-foreground">{row.activityTitle}</td>
                <td className="px-2 py-3 text-xs text-muted">
                  {row.standardIds.length ? row.standardIds.join(", ") : "—"}
                </td>
                <td className="px-2 py-3">
                  <StatusBadge
                    label={PROCESS_STATUS_LABEL[row.processStatus].label}
                    tone={PROCESS_STATUS_LABEL[row.processStatus].tone}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line bg-neutral-bg/40 px-5 py-3.5">
        <p className="text-sm text-muted">
          <b className="text-foreground">{selected.size}</b>개 선택됨
          {error && <span className="ml-3 text-danger">{error}</span>}
        </p>
        <button
          type="button"
          onClick={run}
          disabled={selected.size === 0 || running}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-brand-700 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {running ? "분석 시작 중..." : "선택한 자료 분석 실행"}
        </button>
      </div>
    </div>
  );
}
