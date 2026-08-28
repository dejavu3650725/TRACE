import Link from "next/link";

/**
 * 대시보드용 통계 카드.
 * 값은 실제 DB에서 계산한 수치만 사용한다. 하드코딩 데모 숫자 금지 (TRD §36).
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  href?: string;
  tone?: "default" | "brand" | "warning";
}) {
  const valueClass =
    tone === "brand"
      ? "text-brand-600"
      : tone === "warning"
        ? "text-warning"
        : "text-foreground";

  const body = (
    <div className="group flex h-full flex-col justify-between rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className={`font-display text-3xl font-bold tracking-tight tabular-nums ${valueClass}`}>{value}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}
