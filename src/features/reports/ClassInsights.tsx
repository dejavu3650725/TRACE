import { createClient } from "@/lib/supabase/server";
import { SUBJECT_DOMAINS, parseStandardDomain } from "@/lib/curriculum/domains";
import { DomainRadar, type DomainAxis } from "@/components/charts/DomainRadar";
import { InsightFilters } from "./InsightFilters";

/**
 * 학급 학습 시각화 (학부모 상담용) — 승인된 분석만 사용
 * 교과/영역/학생 필터 + 4개 차트: 성취수준 분포 · 시간 추이 · 교과 영역 레이더 · 학생별 평균
 * 외부 라이브러리 없이 SVG/div (UIUX Master Prompt).
 */

const LEVEL_SCORE: Record<string, number> = { 상: 3, 중: 2, 하: 1 };

interface Row {
  id: string;
  date: Date;
  level: string;
  score: number;
  studentId: string;
  studentLabel: string;
  tags: Array<{ subject: string; domainIndex: number; domain: string }>;
}

export async function ClassInsights({
  subject,
  domain,
  studentId,
}: {
  subject: string | null;
  domain: string | null;
  studentId: string | null;
}) {
  const supabase = await createClient();
  const { data: analyses } = await supabase
    .from("analyses")
    .select(
      `id, analysis_json, updated_at,
       submissions!inner (
         students ( id, name, student_number ),
         activity_assignments ( activities ( activity_standards ( standard_id ) ) )
       )`,
    )
    .in("status", ["APPROVED", "EDITED_APPROVED"])
    .order("updated_at", { ascending: true })
    .limit(500);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  const rows: Row[] = (analyses ?? []).flatMap((a: any) => {
    const submission = one(a.submissions);
    const student = one(submission?.students);
    if (!student) return [];
    const activity = one(one(submission?.activity_assignments)?.activities);
    const standardIds: string[] = (activity?.activity_standards ?? []).map(
      (s: any) => s.standard_id as string,
    );
    const tags = standardIds
      .map((sid) => {
        const parsed = parseStandardDomain(sid);
        if (!parsed) return null;
        return {
          subject: parsed.subject,
          domainIndex: parsed.domainIndex,
          domain: SUBJECT_DOMAINS[parsed.subject]?.[parsed.domainIndex] ?? "기타",
        };
      })
      .filter((t): t is Row["tags"][number] => t !== null);
    const level = (a.analysis_json?.achievement_level as string) ?? "중";
    return [
      {
        id: a.id as string,
        date: new Date(a.updated_at as string),
        level,
        score: LEVEL_SCORE[level] ?? 2,
        studentId: student.id as string,
        studentLabel: `${student.student_number}번 ${student.name}`,
        tags,
      },
    ];
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // ── 필터 적용 ──
  const filtered = rows.filter((r) => {
    if (studentId && r.studentId !== studentId) return false;
    if (subject && !r.tags.some((t) => t.subject === subject)) return false;
    if (subject && domain && !r.tags.some((t) => t.subject === subject && t.domain === domain))
      return false;
    return true;
  });

  // ── 필터 옵션 ──
  const subjects = [...new Set(rows.flatMap((r) => r.tags.map((t) => t.subject)))].sort((a, b) =>
    a.localeCompare(b, "ko-KR"),
  );
  const domains = subject ? (SUBJECT_DOMAINS[subject] ?? []) : [];
  const studentMap = new Map(rows.map((r) => [r.studentId, r.studentLabel]));
  const students = [...studentMap.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko-KR", { numeric: true }));

  const scopeLabel = [
    subject ?? "전체 교과",
    subject && domain ? domain : null,
    studentId ? (studentMap.get(studentId) ?? "학생") : "학급 전체",
  ]
    .filter(Boolean)
    .join(" · ");

  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
        승인된 분석이 쌓이면 학급 학습 시각화가 여기에 표시돼요.
      </section>
    );
  }

  // ── ① 성취수준 분포 ──
  const LEVELS = ["상", "중", "하"] as const;
  const levelCounts = LEVELS.map((lv) => ({
    level: lv,
    count: filtered.filter((r) => r.level === lv).length,
  }));
  const levelMax = Math.max(1, ...levelCounts.map((l) => l.count));

  // ── ② 시간 추이 (날짜별 평균 성취 점수) ──
  const dayFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" });
  const byDay = new Map<string, { sum: number; n: number; order: number }>();
  filtered.forEach((r) => {
    const key = dayFmt.format(r.date);
    const cur = byDay.get(key) ?? { sum: 0, n: 0, order: r.date.getTime() };
    byDay.set(key, { sum: cur.sum + r.score, n: cur.n + 1, order: Math.min(cur.order, r.date.getTime()) });
  });
  const trend = [...byDay.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .slice(-8)
    .map(([label, v]) => ({ label, avg: v.sum / v.n, n: v.n }));
  const N = trend.length;
  const px = (i: number) => (N <= 1 ? 280 : 52 + (i * (508 - 52)) / (N - 1));
  const py = (score: number) => 150 - (score - 1) * 55;
  const trendLine = trend.map((t, i) => `${px(i).toFixed(1)},${py(t.avg).toFixed(1)}`).join(" ");

  // ── ③ 교과 영역 레이더 ──
  const radarSubject = subject ?? subjects[0] ?? null;
  let radarAxes: DomainAxis[] = [];
  if (radarSubject) {
    const domainsOf = SUBJECT_DOMAINS[radarSubject] ?? [];
    radarAxes = domainsOf.map((label, idx) => {
      const scoped = filtered.filter((r) =>
        r.tags.some((t) => t.subject === radarSubject && t.domainIndex === idx),
      );
      if (scoped.length === 0) return { label, value: null, count: 0 };
      const avg = scoped.reduce((acc, r) => acc + r.score, 0) / scoped.length;
      return { label, value: (avg - 1) / 2, count: scoped.length }; // 1~3 → 0~1
    });
  }

  // ── ④ 학생별 평균 (학생 필터 없을 때) ──
  const byStudent = new Map<string, { label: string; sum: number; n: number }>();
  filtered.forEach((r) => {
    const cur = byStudent.get(r.studentId) ?? { label: r.studentLabel, sum: 0, n: 0 };
    byStudent.set(r.studentId, { label: cur.label, sum: cur.sum + r.score, n: cur.n + 1 });
  });
  const studentBars = [...byStudent.values()]
    .map((s) => ({ ...s, avg: s.sum / s.n }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10);

  return (
    <section className="space-y-4" aria-label="학급 학습 시각화">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <InsightFilters
          options={{
            subjects,
            domains,
            students,
            selected: { subject, domain: subject ? domain : null, student: studentId },
          }}
        />
        <span className="rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-bold text-brand-700">
          {scopeLabel} · 승인 {filtered.length}건
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          이 조건에 해당하는 승인 기록이 아직 없어요. 필터를 바꿔보세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* ① 성취수준 분포 */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-foreground">성취수준 분포</h3>
              <span className="text-xs text-muted">{scopeLabel}</span>
            </div>
            <ul className="mt-5 space-y-3.5">
              {levelCounts.map(({ level, count }) => {
                const pct = Math.round((count / levelMax) * 100);
                return (
                  <li key={level} className="flex items-center gap-3">
                    <span className="w-5 shrink-0 text-sm font-semibold text-muted">{level}</span>
                    <span className="relative h-4 flex-1 overflow-hidden rounded-r-[4px] bg-neutral-bg">
                      <span
                        className="animate-grow-x absolute inset-y-0 left-0 rounded-r-[4px] bg-gradient-to-r from-brand-500 to-brand-600"
                        style={{ width: count === 0 ? "0%" : `${Math.max(pct, 4)}%` }}
                      />
                    </span>
                    <span className="w-9 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
                      {count}
                      <span className="ml-0.5 text-[11px] font-medium text-muted">건</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ② 성취 추이 */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-foreground">성취 추이</h3>
              <span className="text-xs text-muted">승인 시점 기준 평균</span>
            </div>
            <svg viewBox="0 0 560 200" className="mt-2 w-full" role="img" aria-label="성취수준 추이 그래프">
              {LEVELS.map((lv) => (
                <g key={lv}>
                  <line x1="40" x2="530" y1={py(LEVEL_SCORE[lv])} y2={py(LEVEL_SCORE[lv])} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 5" />
                  <text x="18" y={py(LEVEL_SCORE[lv]) + 4} fontSize="12" fontWeight="600" fill="#64748b">{lv}</text>
                </g>
              ))}
              {N > 1 && (
                <polyline points={trendLine} pathLength={1} fill="none" stroke="#1d6bf3" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="animate-draw" />
              )}
              {trend.map((t, i) => (
                <g key={t.label} className="animate-fade-late">
                  <circle cx={px(i)} cy={py(t.avg)} r={i === N - 1 ? 5.5 : 4} fill="#1d6bf3" stroke="#ffffff" strokeWidth="2" />
                  <text x={px(i)} y={py(t.avg) - 12} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0f172a" className="tabular-nums">
                    {t.avg.toFixed(1)}
                  </text>
                  <text x={px(i)} y="188" textAnchor="middle" fontSize="11" fill="#64748b">{t.label}</text>
                </g>
              ))}
            </svg>
          </div>

          {/* ③ 교과 영역 레이더 */}
          {radarSubject && radarAxes.length > 0 && (
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-bold text-foreground">
                  교과 영역 프로필 · <span className="text-brand-700">{radarSubject}</span>
                </h3>
                <span className="text-xs text-muted">2022 개정 교육과정</span>
              </div>
              <DomainRadar axes={radarAxes} />
              <p className="mt-1 text-center text-xs text-muted">회색 축은 아직 승인 근거가 없는 영역이에요.</p>
            </div>
          )}

          {/* ④ 학생별 평균 (학급 보기일 때) / 학생 선택 시 안내 */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-foreground">
                {studentId ? "이 학생의 기록 요약" : "학생별 평균 성취"}
              </h3>
              <span className="text-xs text-muted">{studentId ? "필터된 범위" : "높은 순 · 최대 10명"}</span>
            </div>
            {studentId ? (
              <div className="mt-4 space-y-2 text-sm text-foreground">
                <p>
                  승인 기록 <b className="tabular-nums">{filtered.length}</b>건 · 평균 성취{" "}
                  <b className="tabular-nums">
                    {(filtered.reduce((a, r) => a + r.score, 0) / filtered.length).toFixed(1)}
                  </b>
                  /3.0
                </p>
                <p className="text-xs leading-relaxed text-muted">
                  자세한 성장 추이·반복 어려움·후속학습 제안은 아래 학생 목록에서 이 학생을 열어 확인하세요.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {studentBars.map((s) => {
                  const pct = Math.round(((s.avg - 1) / 2) * 100);
                  return (
                    <li key={s.label} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 truncate text-sm font-semibold text-foreground">{s.label}</span>
                      <span className="relative h-3.5 flex-1 overflow-hidden rounded-r-[4px] bg-neutral-bg">
                        <span
                          className="animate-grow-x absolute inset-y-0 left-0 rounded-r-[4px] bg-gradient-to-r from-brand-500 to-brand-600"
                          style={{ width: `${Math.max(pct, 4)}%` }}
                        />
                      </span>
                      <span className="w-10 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
                        {s.avg.toFixed(1)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
