import { ShieldCheck, ShieldAlert, ShieldQuestion, Shield } from "lucide-react";
import { TRUST_LEVEL_LABEL, type StatusTone, type TrustLevel } from "@/shared/types/status";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-neutral-bg text-neutral",
  info: "bg-info-bg text-info",
  warning: "bg-warning-bg text-warning",
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  brand: "bg-brand-50 text-brand-700",
};

const ICON: Record<TrustLevel, React.ReactNode> = {
  HIGH: <ShieldCheck className="h-3.5 w-3.5" />,
  MEDIUM: <Shield className="h-3.5 w-3.5" />,
  LOW: <ShieldAlert className="h-3.5 w-3.5" />,
  UNCERTAIN: <ShieldQuestion className="h-3.5 w-3.5" />,
};

/** AI 신뢰도 4등급 배지 */
export function TrustBadge({ level }: { level: TrustLevel }) {
  const { label, tone } = TRUST_LEVEL_LABEL[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[tone]}`}
    >
      {ICON[level]}
      {label}
    </span>
  );
}
