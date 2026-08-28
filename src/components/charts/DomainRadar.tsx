/**
 * 교과 영역 레이더 — 영역 수(N)에 따라 N각형이 그려진다 (수학 4각, 국어 6각, 체육 3각…).
 * 외부 라이브러리 없이 SVG로 렌더. 영역이 2개(영어)면 레이더 대신 막대로 자동 전환.
 * value: 0~1 지수, null이면 아직 승인 근거가 없는 영역.
 */
export interface DomainAxis {
  label: string;
  value: number | null;
  count: number;
}

export function DomainRadar({ axes }: { axes: DomainAxis[] }) {
  const N = axes.length;

  // 영역 2개 이하 — 레이더가 성립하지 않으므로 가로 막대로
  if (N < 3) {
    return (
      <ul className="mt-3 space-y-3">
        {axes.map((a) => {
          const pct = a.value === null ? 0 : Math.round(a.value * 100);
          return (
            <li key={a.label} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-sm font-semibold text-muted">{a.label}</span>
              <span className="relative h-4 flex-1 overflow-hidden rounded-r-[4px] bg-neutral-bg">
                <span
                  className="animate-grow-x absolute inset-y-0 left-0 rounded-r-[4px] bg-gradient-to-r from-brand-500 to-brand-600"
                  style={{ width: a.value === null ? "0%" : `${Math.max(pct, 4)}%` }}
                />
              </span>
              <span className="w-9 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
                {a.value === null ? "—" : pct}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  const R = 80;
  const CX = 150;
  const CY = 118;
  const pt = (i: number, r: number) => {
    const a = (Math.PI / 180) * (-90 + (i * 360) / N);
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
  };
  const ring = (k: number) =>
    axes
      .map((_, i) => {
        const p = pt(i, R * k);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ");
  const shape = axes
    .map((m, i) => {
      const p = pt(i, R * Math.max(0.05, m.value ?? 0));
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 300 244"
      className="mx-auto w-full max-w-[300px]"
      role="img"
      aria-label={`교과 영역 ${N}각형 레이더 차트`}
    >
      {[1 / 3, 2 / 3, 1].map((k) => (
        <polygon key={k} points={ring(k)} fill="none" stroke="var(--border)" strokeWidth="1" />
      ))}
      {axes.map((_, i) => {
        const p = pt(i, R);
        return (
          <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth="1" />
        );
      })}
      <g className="animate-radar">
        <polygon
          points={shape}
          fill="#1d6bf3"
          fillOpacity="0.16"
          stroke="#1d6bf3"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {axes.map((m, i) => {
          if (m.value === null) return null;
          const p = pt(i, R * Math.max(0.05, m.value));
          return (
            <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#1d6bf3" stroke="#ffffff" strokeWidth="1.5" />
          );
        })}
      </g>
      {axes.map((m, i) => {
        const p = pt(i, R + 25);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y + 4}
            textAnchor="middle"
            fontSize="11.5"
            fontWeight="600"
            fill={m.value === null ? "#94a3b8" : "#475569"}
          >
            {m.label}
          </text>
        );
      })}
    </svg>
  );
}
