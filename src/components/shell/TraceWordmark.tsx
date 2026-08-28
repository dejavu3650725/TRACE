import Link from "next/link";

/** TRACE 워드마크 — 로고 컬러(브랜드 블루 + 포인트 도트) */
export function TraceWordmark({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-baseline gap-0.5 select-none">
      <span className="text-xl font-extrabold tracking-[0.18em] text-brand-600">
        TRACE
      </span>
      <span className="h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-brand-dot" />
    </Link>
  );
}
