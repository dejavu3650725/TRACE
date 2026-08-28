/**
 * 장시간 작업 진행 패널 (TRD §28, §44)
 * 일부 실패를 전체 실패로 표시하지 않는다 (Partial Success).
 */
export function ProgressPanel({
  title,
  currentStep,
  total,
  completed,
  failed = 0,
}: {
  title: string;
  currentStep?: string;
  total: number;
  completed: number;
  failed?: number;
}) {
  const pct = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm font-bold text-brand-700">{pct}%</p>
      </div>
      {currentStep && <p className="mt-1 text-xs text-muted">{currentStep}</p>}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-bg">
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted">
        <span>
          전체 <b className="text-foreground">{total}</b>
        </span>
        <span>
          완료 <b className="text-success">{completed}</b>
        </span>
        {failed > 0 && (
          <span>
            실패 <b className="text-danger">{failed}</b>
          </span>
        )}
      </div>
    </div>
  );
}
