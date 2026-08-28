import type { StatusTone } from "@/shared/types/status";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-neutral-bg text-neutral",
  info: "bg-info-bg text-info",
  warning: "bg-warning-bg text-warning",
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  brand: "bg-brand-50 text-brand-700",
};

const DOT_CLASS: Record<StatusTone, string> = {
  neutral: "bg-neutral",
  info: "bg-info",
  warning: "bg-warning",
  success: "bg-success",
  danger: "bg-danger",
  brand: "bg-brand-600",
};

/**
 * 상태 뱃지 — 검토 대기 / 분석 준비 / 승인 완료 등.
 * label은 반드시 shared/types/status.ts의 UI Mapping을 통해 전달한다 (기술 Enum 노출 금지).
 */
export function StatusBadge({
  label,
  tone = "neutral",
  withDot = true,
  className = "",
}: {
  label: string;
  tone?: StatusTone;
  withDot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[tone]} ${className}`}
    >
      {withDot && <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[tone]}`} />}
      {label}
    </span>
  );
}
