import Link from "next/link";
import { Inbox } from "lucide-react";

/**
 * 비어있음 상태 — 행동 가능한 CTA를 함께 제공한다 (TRD §49).
 */
export function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  onCtaClick,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
}) {
  const cta =
    ctaLabel &&
    (ctaHref ? (
      <Link
        href={ctaHref}
        className="mt-4 inline-flex items-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-brand-700"
      >
        {ctaLabel}
      </Link>
    ) : (
      <button
        type="button"
        onClick={onCtaClick}
        className="mt-4 inline-flex items-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-brand-700"
      >
        {ctaLabel}
      </button>
    ));

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {cta}
    </div>
  );
}
