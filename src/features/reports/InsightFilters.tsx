"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";

/**
 * 학급 학습 시각화 필터 — 교과 / 영역 / 학생 (URL 쿼리 기반, 선택 즉시 반영)
 * 학부모 상담 중 한 손으로 조작할 수 있게 셀렉트 3개로 단순하게.
 */
export interface InsightFilterOptions {
  subjects: string[];
  domains: string[];
  students: Array<{ id: string; label: string }>;
  selected: { subject: string | null; domain: string | null; student: string | null };
}

export function InsightFilters({ options }: { options: InsightFilterOptions }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const apply = (key: "fs" | "fd" | "fst", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key === "fs") params.delete("fd"); // 교과가 바뀌면 영역 초기화
    router.replace(`/reports?${params.toString()}`, { scroll: false });
  };

  const selectClass =
    "h-10 min-w-32 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-foreground outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-muted">
        <Filter className="h-4 w-4" /> 필터
      </span>
      <select
        aria-label="교과 필터"
        value={options.selected.subject ?? ""}
        onChange={(e) => apply("fs", e.target.value)}
        className={selectClass}
      >
        <option value="">전체 교과</option>
        {options.subjects.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        aria-label="영역 필터"
        value={options.selected.domain ?? ""}
        onChange={(e) => apply("fd", e.target.value)}
        disabled={!options.selected.subject}
        className={`${selectClass} disabled:opacity-50`}
      >
        <option value="">전체 영역</option>
        {options.domains.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        aria-label="학생 필터"
        value={options.selected.student ?? ""}
        onChange={(e) => apply("fst", e.target.value)}
        className={selectClass}
      >
        <option value="">학급 전체</option>
        {options.students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      {(options.selected.subject || options.selected.student) && (
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("fs");
            params.delete("fd");
            params.delete("fst");
            router.replace(`/reports?${params.toString()}`, { scroll: false });
          }}
          className="h-10 rounded-xl px-3 text-sm font-bold text-muted hover:bg-neutral-bg hover:text-foreground"
        >
          초기화
        </button>
      )}
    </div>
  );
}
