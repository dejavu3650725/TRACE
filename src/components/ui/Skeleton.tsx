/** 로딩 스켈레톤 (TRD §49) */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-neutral-bg ${className}`} />;
}

/** 카드형 스켈레톤 묶음 — 페이지 loading.tsx에서 재사용 */
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-72" />
    </div>
  );
}
