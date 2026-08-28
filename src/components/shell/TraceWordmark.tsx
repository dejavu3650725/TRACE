import Image from "next/image";
import Link from "next/link";

/**
 * TRACE 공용 브랜드 표면 — 채택된 A-마크 아이콘 + 워드마크 타이포.
 * size: md(셸/사이드바) · lg(로그인 등 히어로 영역)
 */
export function TraceWordmark({
  href = "/dashboard",
  size = "md",
  className = "",
}: {
  href?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const iconClass = size === "lg" ? "h-14 w-auto" : "h-9 w-auto";
  const textClass =
    size === "lg"
      ? "text-[1.75rem] tracking-[0.18em]"
      : "text-lg tracking-[0.16em]";

  return (
    <Link
      href={href}
      className={`inline-flex select-none items-center gap-2.5 ${className}`}
      aria-label="TRACE 홈"
    >
      <Image
        src="/trace-icon.png"
        alt=""
        width={163}
        height={155}
        priority
        className={iconClass}
      />
      <span
        className={`font-display font-extrabold leading-none text-brand-600 ${textClass}`}
      >
        TRACE
      </span>
    </Link>
  );
}
