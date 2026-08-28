import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Inbox, CheckCircle2, ClipboardList, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "대시보드" };
export const dynamic = "force-dynamic";

/**
 * 통합 대시보드 (TRD §36)
 * 카드 값은 실제 DB 집계 — 하드코딩 데모 숫자 금지.
 * Owner: Shared View (모듈 상태 집계)
 */
export default async function DashboardPage() {
  const hasSupabaseEnv = Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY),
  );

  let openAssignments = 0;
  let submissionCount = 0;
  let reviewPending = 0;
  let approvedCount = 0;
  let todos: Array<{ analysisId: string; label: string }> = [];
  let levelDist: Array<{ level: string; count: number }> = [];
  let dailyTrend: Array<{ label: string; count: number }> = [];
  let approvedAnalysesTotal = 0;
  let radar: Array<{ label: string; value: number }> = [];

  if (hasSupabaseEnv) {
    const supabase = await createClient();

    const [assignments, submissions, pending, approved, drafts, approvedAnalyses] = await Promise.all([
      supabase
        .from("activity_assignments")
        .select("id", { count: "exact", head: true })
        .eq("status", "OPEN"),
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .not("submitted_at", "is", null),
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("process_status", "REVIEW_REQUIRED"),
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("process_status", "APPROVED"),
      supabase
        .from("analyses")
        .select(
          `id, submissions ( students ( name, student_number ),
             activity_assignments ( activities ( title ) ) )`,
        )
        .in("status", ["AI_DRAFT", "TEACHER_REVIEW"])
        .order("created_at", { ascending: true })
        .limit(5),
      supabase
        .from("analyses")
        .select("analysis_json, updated_at")
        .in("status", ["APPROVED", "EDITED_APPROVED"])
        .limit(500),
    ]);

    openAssignments = assignments.count ?? 0;
    submissionCount = submissions.count ?? 0;
    reviewPending = pending.count ?? 0;
    approvedCount = approved.count ?? 0;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const one = (v: any) => (Array.isArray(v) ? v[0] : v);
    todos = (drafts.data ?? []).map((d: any) => {
      const submission = one(d.submissions);
      const student = one(submission?.students);
      const activity = one(one(submission?.activity_assignments)?.activities);
      return {
        analysisId: d.id as string,
        label: `${student ? `${student.student_number}번 ${student.name}` : "학생"} · ${activity?.title ?? "활동"}`,
      };
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // ── 성장 흐름 차트 데이터 (승인된 분석 기반) ──
    const approvedRows = approvedAnalyses.data ?? [];
    approvedAnalysesTotal = approvedRows.length;

    // 1) 성취수준 분포 — 상/중/하 고정 순서
    const LEVELS = ["상", "중", "하"] as const;
    const levelCounts = new Map<string, number>(LEVELS.map((l) => [l, 0]));
    for (const row of approvedRows) {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const level = (row.analysis_json as any)?.achievement_level;
      if (typeof level === "string" && levelCounts.has(level)) {
        levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1);
      }
    }
    levelDist = LEVELS.map((level) => ({ level, count: levelCounts.get(level) ?? 0 }));

    // 2) 최근 7일 승인 추이 — Asia/Seoul 날짜 기준
    const dayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dayLabel = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      weekday: "short",
    });
    const now = Date.now();
    const days: Array<{ key: string; label: string }> = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      days.push({
        key: dayKey.format(d),
        label: i === 0 ? "오늘" : dayLabel.format(d),
      });
    }
    const trendCounts = new Map<string, number>(days.map((d) => [d.key, 0]));
    for (const row of approvedRows) {
      if (!row.updated_at) continue;
      const key = dayKey.format(new Date(row.updated_at as string));
      if (trendCounts.has(key)) {
        trendCounts.set(key, (trendCounts.get(key) ?? 0) + 1);
      }
    }
    dailyTrend = days.map((d) => ({ label: d.label, count: trendCounts.get(d.key) ?? 0 }));

    // 3) 학급 역량 프로필 — 승인 분석에서 자동 집계한 6개 지수 (0~1)
    if (approvedRows.length > 0) {
      const levelScore: Record<string, number> = { 상: 1, 중: 0.65, 하: 0.35 };
      let levelSum = 0;
      let strengthSum = 0;
      let evidenceSum = 0;
      let diffTotal = 0;
      let diffRepeated = 0;
      for (const row of approvedRows) {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        const j = row.analysis_json as any;
        levelSum += levelScore[j?.achievement_level] ?? 0.5;
        strengthSum += Math.min(j?.strengths?.length ?? 0, 3) / 3;
        evidenceSum += Math.min(j?.evidence?.length ?? 0, 3) / 3;
        for (const d of j?.difficulties ?? []) {
          diffTotal += 1;
          if (d?.is_repeated_error) diffRepeated += 1;
        }
      }
      const n = approvedRows.length;
      const reviewDone =
        approvedCount + reviewPending > 0 ? approvedCount / (approvedCount + reviewPending) : 1;
      const coverage = submissionCount > 0 ? Math.min(1, n / submissionCount) : 0;
      radar = [
        { label: "성취수준", value: levelSum / n },
        { label: "강점 발견", value: strengthSum / n },
        { label: "근거 연결", value: evidenceSum / n },
        { label: "오류 극복", value: diffTotal > 0 ? 1 - diffRepeated / diffTotal : 1 },
        { label: "검토 완성", value: reviewDone },
        { label: "분석 참여", value: coverage },
      ];
    }
  }

  // ── 차트 지오메트리 — 서버에서 계산해 라이브러리 없이 SVG로 렌더 ──
  const trendMax = Math.max(1, ...dailyTrend.map((d) => d.count));
  const trendPts = dailyTrend.map((d, i) => ({
    ...d,
    x: 40 + i * 80,
    y: 178 - (d.count / trendMax) * 128,
  }));
  const trendLine = trendPts.map((p) => `${p.x},${p.y.toFixed(1)}`).join(" ");
  const trendArea = `40,178 ${trendLine} 520,178`;

  const RADAR_R = 88;
  const RADAR_CX = 140;
  const RADAR_CY = 122;
  const radarPoint = (i: number, r: number) => {
    const a = (Math.PI / 180) * (-90 + i * 60);
    return { x: RADAR_CX + r * Math.cos(a), y: RADAR_CY + r * Math.sin(a) };
  };
  const radarRings = [1 / 3, 2 / 3, 1].map((k) =>
    Array.from({ length: 6 }, (_, i) => {
      const p = radarPoint(i, RADAR_R * k);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" "),
  );
  const radarShape = radar
    .map((m, i) => {
      const p = radarPoint(i, RADAR_R * Math.max(0.06, m.value));
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="space-y-8">
      <PageHeader
        title="오늘의 TRACE"
        description="학급의 제출·검토·분석 현황을 한눈에 확인하세요."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="진행 중 활동"
          value={openAssignments}
          icon={<ClipboardList className="h-4.5 w-4.5" />}
          href="/results"
          hint={openAssignments === 0 ? "아직 배정된 활동이 없어요" : "배정된 활동"}
        />
        <StatCard
          label="제출 현황"
          value={submissionCount}
          icon={<FolderOpen className="h-4.5 w-4.5" />}
          href="/results"
          hint={submissionCount === 0 ? "제출된 자료가 없어요" : "수집된 제출물"}
        />
        <StatCard
          label="검토 대기"
          value={reviewPending}
          tone="warning"
          icon={<Inbox className="h-4.5 w-4.5" />}
          href="/analysis"
          hint={reviewPending === 0 ? "검토할 분석이 없어요" : "AI 초안 검토 필요"}
        />
        <StatCard
          label="승인 완료"
          value={approvedCount}
          tone="brand"
          icon={<CheckCircle2 className="h-4.5 w-4.5" />}
          href="/analysis#approved"
          hint={approvedCount === 0 ? "승인된 분석이 없어요" : "확정된 학습 근거"}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">지금 할 일</h2>
        {todos.length === 0 ? (
          <EmptyState
            title="지금 처리할 일이 없어요"
            description="학습자료를 추가하면 검토·분석할 일이 여기에 모여요."
            ctaLabel="학습자료 추가하러 가기"
            ctaHref="/results/add"
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
            {todos.map((todo) => (
              <li key={todo.analysisId}>
                <Link
                  href={`/analysis/${todo.analysisId}/review`}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition-colors duration-150 hover:bg-brand-50/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {todo.label}
                    </span>
                    <span className="text-xs text-muted">AI 분석 초안 검토가 필요해요</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge label="검토 대기" tone="warning" />
                    <ChevronRight className="h-4 w-4 text-muted" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">성장 흐름</h2>
        {/* 차트는 외부 라이브러리 없이 div+flex+% 로 구현 (UIUX Master Prompt) */}
        {approvedAnalysesTotal === 0 ? (
          <EmptyState
            title="아직 성장 데이터가 없어요"
            description="승인된 분석이 누적되면 학급의 성장 흐름이 차트로 표시돼요."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* 성취수준 분포 — 가로 막대 */}
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-bold text-foreground">성취수준 분포</h3>
                <span className="text-xs text-muted">
                  승인 분석{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {approvedAnalysesTotal}
                  </span>
                  건 기준
                </span>
              </div>
              <ul className="mt-4 space-y-3">
                {levelDist.map(({ level, count }) => {
                  const max = Math.max(1, ...levelDist.map((d) => d.count));
                  const pct = Math.round((count / max) * 100);
                  return (
                    <li key={level} className="flex items-center gap-3">
                      <span className="w-5 shrink-0 text-sm font-semibold text-muted">
                        {level}
                      </span>
                      <span className="relative h-4 flex-1 overflow-hidden rounded-r-[4px] bg-neutral-bg">
                        <span
                          className="absolute inset-y-0 left-0 rounded-r-[4px] bg-gradient-to-r from-brand-500 to-brand-600 transition-[width] duration-500"
                          style={{ width: count === 0 ? "0%" : `${Math.max(pct, 4)}%` }}
                        />
                      </span>
                      <span className="w-9 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
                        {count}
                        <span className="ml-0.5 text-[11px] font-medium text-muted">명</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* 최근 7일 승인 추이 — 꺾은선 + 그라데이션 영역 (SVG, 라이브러리 없음) */}
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-bold text-foreground">최근 7일 승인 추이</h3>
                <span className="text-xs text-muted">확정된 학습 근거가 쌓이는 속도</span>
              </div>
              <svg viewBox="0 0 560 214" className="mt-2 w-full" role="img" aria-label="최근 7일 승인 추이 꺾은선 그래프">
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1d6bf3" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#1d6bf3" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <line x1="40" x2="520" y1="50" y2="50" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 5" />
                <line x1="40" x2="520" y1="114" y2="114" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 5" />
                <line x1="40" x2="520" y1="178" y2="178" stroke="var(--border)" strokeWidth="1.5" />
                <polygon points={trendArea} fill="url(#trendFill)" />
                <polyline
                  points={trendLine}
                  fill="none"
                  stroke="#1d6bf3"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {trendPts.map((p, i) => (
                  <g key={i}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={i === trendPts.length - 1 ? 5 : 4}
                      fill={p.count > 0 ? "#1d6bf3" : "#ffffff"}
                      stroke={p.count > 0 ? "#ffffff" : "var(--border)"}
                      strokeWidth="2"
                    />
                    {p.count > 0 && (
                      <text
                        x={p.x}
                        y={p.y - 12}
                        textAnchor="middle"
                        fontSize="13"
                        fontWeight="700"
                        fill="#0f172a"
                        className="tabular-nums"
                      >
                        {p.count}
                      </text>
                    )}
                    <text
                      x={p.x}
                      y={202}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight={p.label === "오늘" ? 700 : 500}
                      fill={p.label === "오늘" ? "#1d4ed8" : "#64748b"}
                    >
                      {p.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        )}

        {/* 학급 역량 프로필 — 육각 레이더 + 지수 카드 (승인 분석 자동 집계) */}
        {approvedAnalysesTotal > 0 && radar.length > 0 && (
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-foreground">학급 역량 프로필</h3>
              <span className="text-xs text-muted">
                교사·학부모·학생이 함께 보는 객관 지표 · 100점 만점 지수
              </span>
            </div>
            <div className="mt-4 flex flex-col items-center gap-8 lg:flex-row">
              <svg
                viewBox="0 0 280 250"
                className="w-full max-w-[300px] shrink-0"
                role="img"
                aria-label="학급 역량 육각형 레이더 차트"
              >
                {radarRings.map((pts, k) => (
                  <polygon key={k} points={pts} fill="none" stroke="var(--border)" strokeWidth="1" />
                ))}
                {Array.from({ length: 6 }, (_, i) => {
                  const p = radarPoint(i, RADAR_R);
                  return (
                    <line
                      key={i}
                      x1={RADAR_CX}
                      y1={RADAR_CY}
                      x2={p.x}
                      y2={p.y}
                      stroke="var(--border)"
                      strokeWidth="1"
                    />
                  );
                })}
                <polygon
                  points={radarShape}
                  fill="#1d6bf3"
                  fillOpacity="0.16"
                  stroke="#1d6bf3"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                {radar.map((m, i) => {
                  const p = radarPoint(i, RADAR_R * Math.max(0.06, m.value));
                  return (
                    <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#1d6bf3" stroke="#ffffff" strokeWidth="1.5" />
                  );
                })}
                {radar.map((m, i) => {
                  const p = radarPoint(i, RADAR_R + 24);
                  return (
                    <text
                      key={i}
                      x={p.x}
                      y={p.y + 4}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="600"
                      fill="#475569"
                    >
                      {m.label}
                    </text>
                  );
                })}
              </svg>

              <ul className="grid w-full flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                {radar.map((m) => {
                  const pct = Math.round(m.value * 100);
                  return (
                    <li key={m.label} className="rounded-xl bg-neutral-bg/50 px-4 py-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-semibold text-foreground">{m.label}</span>
                        <span className="font-display text-sm font-bold tabular-nums text-brand-700">
                          {pct}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600"
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="mt-4 text-center text-xs text-muted">
              승인된 분석 {approvedAnalysesTotal}건에서 자동 집계 — 승인이 쌓일수록 프로필이 정교해져요.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
