import type { Metadata } from "next";
import { BadgeCheck, Quote, Repeat2, Sparkles, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/server";
import { getStandard } from "@/lib/curriculum/loader";
import { SUBJECT_DOMAINS, parseStandardDomain } from "@/lib/curriculum/domains";
import { DomainRadar, type DomainAxis } from "@/components/charts/DomainRadar";

export const metadata: Metadata = { title: "학생 리포트" };
export const dynamic = "force-dynamic";

/**
 * Student Report /reports/students/[studentId] (TRD §46, PRD §0.1)
 * 섹션 순서 고정: ① 최근 성장 → ② 반복되는 어려움 → ③ 후속학습 제안
 * 데이터 원천: 교사가 승인한 분석(APPROVED/EDITED_APPROVED)만 사용한다.
 */

const LEVEL_SCORE: Record<string, number> = { 상: 3, 중: 2, 하: 1 };
const LEVEL_TONE: Record<string, "success" | "info" | "warning"> = {
  상: "success",
  중: "info",
  하: "warning",
};

export default async function StudentReportPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, name, student_number, classes ( name )")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) {
    return (
      <div className="space-y-6">
        <PageHeader title="학생 리포트" />
        <ErrorState title="학생을 찾을 수 없어요" description="목록에서 다시 선택해 주세요." />
      </div>
    );
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  const className = one((student as any).classes)?.name ?? "";
  const studentLabel = `${student.student_number}번 ${student.name}`;

  const { data: analyses } = await supabase
    .from("analyses")
    .select(
      `id, analysis_json, updated_at, version_no,
       submissions!inner ( student_id,
         activity_assignments ( activities ( title, activity_standards ( standard_id ) ) ) )`,
    )
    .eq("submissions.student_id", studentId)
    .in("status", ["APPROVED", "EDITED_APPROVED"])
    .order("updated_at", { ascending: true })
    .limit(50);

  const rows = (analyses ?? []).map((a: any) => {
    const submission = one(a.submissions);
    const activity = one(one(submission?.activity_assignments)?.activities);
    const standardIds: string[] = (activity?.activity_standards ?? []).map(
      (s: any) => s.standard_id as string,
    );
    const j = a.analysis_json ?? {};
    return {
      id: a.id as string,
      updatedAt: a.updated_at as string,
      versionNo: a.version_no as number,
      activityTitle: (activity?.title as string) ?? "활동",
      standardIds,
      level: (j.achievement_level as string) ?? "중",
      strengths: (j.strengths as string[]) ?? [],
      difficulties: (j.difficulties as Array<{ text: string; is_repeated_error: boolean }>) ?? [],
      evidence: (j.evidence as Array<{ claim: string; question_id?: string }>) ?? [],
      feedback: (j.feedback_candidate as string) ?? "",
    };
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="학생 리포트" description={`${studentLabel}${className ? ` · ${className}` : ""}`} />
        <EmptyState
          title="아직 승인된 학습 근거가 없어요"
          description="분석을 승인하면 이 학생의 성장 리포트가 여기에 쌓여요."
          ctaLabel="평가관리로 가기"
          ctaHref="/analysis"
        />
      </div>
    );
  }

  // ── ① 최근 성장: 승인 시간순 성취수준 추이 ──
  const dateFmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  });
  const timeline = rows.slice(-8).map((r) => ({
    ...r,
    dateLabel: dateFmt.format(new Date(r.updatedAt)),
    score: LEVEL_SCORE[r.level] ?? 2,
  }));
  const N = timeline.length;
  const CHART_W = 560;
  const px = (i: number) => (N === 1 ? CHART_W / 2 : 60 + (i * (CHART_W - 120)) / (N - 1));
  const py = (score: number) => 150 - (score - 1) * 55; // 하=150, 중=95, 상=40
  const growthLine = timeline.map((t, i) => `${px(i).toFixed(1)},${py(t.score)}`).join(" ");
  const latest = timeline[N - 1];
  const improved = N >= 2 && timeline[N - 1].score > timeline[0].score;

  // ── 교과 영역 레이더 (이 학생의 승인 근거만) ──
  const domainAgg = new Map<string, Map<number, { sum: number; n: number }>>();
  const RADAR_SCORE: Record<string, number> = { 상: 1, 중: 0.65, 하: 0.35 };
  for (const r of rows) {
    for (const sid of r.standardIds) {
      const parsed = parseStandardDomain(sid);
      if (!parsed) continue;
      if (!domainAgg.has(parsed.subject)) domainAgg.set(parsed.subject, new Map());
      const bySubject = domainAgg.get(parsed.subject)!;
      const cur = bySubject.get(parsed.domainIndex) ?? { sum: 0, n: 0 };
      bySubject.set(parsed.domainIndex, {
        sum: cur.sum + (RADAR_SCORE[r.level] ?? 0.5),
        n: cur.n + 1,
      });
    }
  }
  const subjectProfiles = Array.from(domainAgg.entries()).map(([subject, bySubject]) => {
    const domains = SUBJECT_DOMAINS[subject] ?? [];
    const axes: DomainAxis[] = domains.map((label, idx) => {
      const agg = bySubject.get(idx);
      return agg ? { label, value: agg.sum / agg.n, count: agg.n } : { label, value: null, count: 0 };
    });
    return { subject, axes };
  });

  // ── ② 반복되는 어려움 ──
  const repeatCount = new Map<string, number>();
  for (const r of rows) {
    for (const d of r.difficulties) {
      if (d.is_repeated_error) repeatCount.set(d.text, (repeatCount.get(d.text) ?? 0) + 1);
    }
  }
  const repeated = Array.from(repeatCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // ── ③ 후속학습 제안: 성취기준의 다음 단계 기술 + 반복 어려움 보충 ──
  const LEVEL_ORDER = ["하", "중", "상"];
  const suggestions: Array<{ title: string; body: string }> = [];
  const latestStandards = latest.standardIds.map((id) => getStandard(id)).filter(Boolean);
  for (const std of latestStandards.slice(0, 2)) {
    if (!std) continue;
    const idx = LEVEL_ORDER.indexOf(latest.level);
    const next = idx >= 0 && idx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[idx + 1] : null;
    if (next) {
      const nextDesc = std.achievement_levels.find((l) => l.level === next)?.description;
      if (nextDesc) {
        suggestions.push({
          title: `다음 단계 목표 (성취수준 ${next})`,
          body: `[${std.standard_id}] ${nextDesc}`,
        });
      }
    } else {
      suggestions.push({
        title: "심화·확장 제안",
        body: `[${std.standard_id}] 현재 최고 수준을 유지하고 있어요. 실생활 맥락 문제로 확장해 보세요.`,
      });
    }
  }
  for (const [text] of repeated.slice(0, 2)) {
    suggestions.push({
      title: "반복 어려움 보충",
      body: `「${text}」 — 같은 유형의 문제를 짧게 다시 다뤄 개념을 확인해요.`,
    });
  }

  // ── 최근 강점 / 확정 근거 ──
  const recentStrengths = latest.strengths.slice(0, 3);
  const recentEvidence = latest.evidence.slice(0, 4);
  const activityCount = new Set(rows.map((r) => r.activityTitle)).size;

  return (
    <div className="space-y-8">
      <div className="animate-rise">
        <PageHeader
          title="학생 리포트"
          description={`${studentLabel}${className ? ` · ${className}` : ""} · 승인된 학습 근거만으로 작성돼요`}
        />
      </div>

      {/* 요약 칩 */}
      <div className="animate-rise flex flex-wrap items-center gap-2" style={{ animationDelay: "0.08s" }}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-bold text-brand-700">
          <BadgeCheck className="h-4 w-4" /> 승인 근거 {rows.length}건
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-bg px-3.5 py-1.5 text-sm font-semibold text-foreground">
          활동 {activityCount}개
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-bg px-3.5 py-1.5 text-sm font-semibold text-foreground">
          최근 성취수준 <StatusBadge label={latest.level} tone={LEVEL_TONE[latest.level] ?? "info"} />
        </span>
        {improved && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-3.5 py-1.5 text-sm font-bold text-success">
            <TrendingUp className="h-4 w-4" /> 성장 중
          </span>
        )}
      </div>

      {/* ① 최근 성장 */}
      <section className="animate-rise space-y-3" style={{ animationDelay: "0.16s" }}>
        <h2 className="text-lg font-bold text-foreground">① 최근 성장</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-foreground">성취수준 추이</h3>
              <span className="text-xs text-muted">승인 시점 기준</span>
            </div>
            <svg viewBox="0 0 560 200" className="mt-2 w-full" role="img" aria-label="성취수준 추이 그래프">
              {(["상", "중", "하"] as const).map((lv) => (
                <g key={lv}>
                  <line
                    x1="40"
                    x2="520"
                    y1={py(LEVEL_SCORE[lv])}
                    y2={py(LEVEL_SCORE[lv])}
                    stroke="var(--border)"
                    strokeWidth="1"
                    strokeDasharray="3 5"
                  />
                  <text x="20" y={py(LEVEL_SCORE[lv]) + 4} fontSize="12" fontWeight="600" fill="#64748b">
                    {lv}
                  </text>
                </g>
              ))}
              <polyline
                points={growthLine}
                pathLength={1}
                fill="none"
                stroke="#1d6bf3"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                className="animate-draw"
              />
              {timeline.map((t, i) => (
                <g key={t.id} className="animate-fade-late">
                  <circle
                    cx={px(i)}
                    cy={py(t.score)}
                    r={i === N - 1 ? 5.5 : 4}
                    fill="#1d6bf3"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <text x={px(i)} y={py(t.score) - 12} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0f172a">
                    {t.level}
                  </text>
                  <text x={px(i)} y="184" textAnchor="middle" fontSize="11" fill="#64748b">
                    {t.dateLabel}
                    {t.versionNo > 1 ? ` · v${t.versionNo}` : ""}
                  </text>
                </g>
              ))}
            </svg>
            <p className="mt-1 text-center text-xs text-muted">
              최근 활동: {latest.activityTitle}
            </p>
          </div>

          {subjectProfiles.map(({ subject, axes }) => (
            <div key={subject} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-bold text-foreground">
                  교과 영역 프로필 · <span className="text-brand-700">{subject}</span>
                </h3>
                <span className="text-xs text-muted">2022 개정 교육과정</span>
              </div>
              <DomainRadar axes={axes} />
              <p className="mt-1 text-center text-xs text-muted">승인이 쌓이면 비어 있는 영역이 채워져요.</p>
            </div>
          ))}
        </div>
      </section>

      {/* ② 반복되는 어려움 */}
      <section className="animate-rise space-y-3" style={{ animationDelay: "0.24s" }}>
        <h2 className="text-lg font-bold text-foreground">② 반복되는 어려움</h2>
        {repeated.length === 0 ? (
          <div className="rounded-2xl border border-success/20 bg-success-bg px-5 py-4 text-sm font-semibold text-success">
            반복되는 오류가 발견되지 않았어요. 현재 학습 흐름을 유지해 주세요.
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
            {repeated.map(([text, count]) => (
              <li key={text} className="flex items-center justify-between gap-3 px-5 py-4">
                <span className="flex min-w-0 items-center gap-2.5 text-sm text-foreground">
                  <Repeat2 className="h-4 w-4 shrink-0 text-warning" />
                  <span className="min-w-0">{text}</span>
                </span>
                <StatusBadge label={`${count}회 관찰`} tone="warning" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ③ 후속학습 제안 */}
      <section className="animate-rise space-y-3" style={{ animationDelay: "0.32s" }}>
        <h2 className="text-lg font-bold text-foreground">③ 후속학습 제안</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="rounded-2xl border border-brand-100 bg-gradient-to-b from-brand-50/60 to-surface p-5"
            >
              <p className="flex items-center gap-1.5 text-sm font-bold text-brand-700">
                <Sparkles className="h-4 w-4" /> {s.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 강점 & 확정 근거 */}
      <section className="animate-rise grid grid-cols-1 gap-4 lg:grid-cols-2" style={{ animationDelay: "0.4s" }}>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <h3 className="text-sm font-bold text-foreground">최근 강점</h3>
          <ul className="mt-3 space-y-2">
            {recentStrengths.map((s, i) => (
              <li key={i} className="rounded-xl bg-success-bg/60 px-3.5 py-2.5 text-sm text-foreground">
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <h3 className="text-sm font-bold text-foreground">확정된 학습 근거</h3>
          <ul className="mt-3 space-y-2">
            {recentEvidence.map((e, i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl bg-brand-50/60 px-3.5 py-2.5 text-sm text-foreground">
                <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                <span>
                  &ldquo;{e.claim}&rdquo;
                  {e.question_id && <span className="ml-1.5 text-xs text-muted">{e.question_id}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="text-center text-xs text-muted">
        이 리포트는 선생님이 직접 승인한 분석만으로 작성되었어요 · 학생 이름과 번호는 AI로 전송되지 않습니다.
      </p>
    </div>
  );
}
