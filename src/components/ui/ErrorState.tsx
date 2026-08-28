"use client";

import { AlertTriangle } from "lucide-react";

/**
 * 에러 상태 — 재시도 가능하면 행동 버튼을 제공한다 (TRD §49).
 */
export function ErrorState({
  title = "문제가 발생했어요",
  description = "잠시 후 다시 시도해 주세요.",
  retryLabel = "다시 시도",
  onRetry,
}: {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-danger/20 bg-danger-bg/60 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-colors duration-200 hover:bg-neutral-bg"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
