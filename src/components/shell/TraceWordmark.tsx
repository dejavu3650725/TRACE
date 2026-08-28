import Image from "next/image";
import Link from "next/link";

/** 채택된 TRACE concept01 로고를 사용하는 공용 브랜드 표면. */
export function TraceWordmark({
  href = "/dashboard",
  className = "w-32",
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link href={href} className="inline-flex shrink-0" aria-label="TRACE 홈">
      <Image
        src="/trace-logo-horizontal-v1.png"
        alt="TRACE"
        width={2073}
        height={758}
        priority
        className={`h-auto ${className}`}
      />
    </Link>
  );
}
