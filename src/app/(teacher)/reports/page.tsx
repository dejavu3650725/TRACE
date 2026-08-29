import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  Search,
  TrendingDown,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { ClassInsights } from "@/features/reports/ClassInsights";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TabNav } from "@/components/ui/TabNav";
import {
  loadReportIndexData,
  type StudentLearningTrend,
} from "@/lib/output/report-index-data";

export const metadata: Metadata = { title: "리포트" };
export const dynamic = "force-dynamic";

type ReportView = "all" | "cumulative" | "difficulty";
type ReportSearchParams = { view?: string; q?: string; fs?: string; fd?: string; fst?: string };

const TREND_LABEL: Record<StudentLearningTrend, {
  label: string;
  tone: "success" | "info" | "warning" | "brand" | "neutral";
}> = {
  UP: { label: "성취 상승 관찰", tone: "success" },
  STABLE: { label: "성취 수준 유지", tone: "info" },
  DOWN: { label: "추가 관찰 필요", tone: "warning" },
  NEW: { label: "첫 승인 기록", tone: "brand" },
  UNKNOWN: { label: "변화 비교 대기", tone: "neutral" },
};

function reportView(value: string | undefined): ReportView {
  return value === "cumulative" || value === "difficulty" ? value : "all";
}

function reportHref(view: ReportView, query: ReportSearchParams): string {
  const params = new URLSearchParams();
  if (view !== "all") params.set("view", view);
  if (query.q?.trim()) params.set("q", query.q.trim());
  const encoded = params.toString();
  return encoded ? `/reports?${encoded}` : "/reports";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>;
}) {
  const query = await searchParams;
  const activeView = reportView(query.view);
  const data = await loadReportIndexData();
  const keyword = query.q?.trim().toLocaleLowerCase("ko-KR") ?? "";
  const viewStudents = data.students.filter((student) => {
    if (activeView === "cumulative" && student.records.length < 2) return false;
    if (activeView === "difficulty" && !student.hasRepeatedDifficulty) return false;
    return !keyword || student.searchText.includes(keyword);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="성장 리포트"
        description="교사가 승인한 학생별 활동 기록과 시간에 따른 변화를 조회해요."
      />

      {/* 학급 학습 시각화 — 학부모 상담용, 교과/영역/학생 필터 (승인 분석만) */}
      <ClassInsights
        subject={query.fs?.trim() || null}
        domain={query.fd?.trim() || null}
        studentId={query.fst?.trim() || null}
      />

      <TabNav
        activeKey={activeView}
        items={[
          { key: "all", label: "전체 학생", count: data.students.length, href: reportHref("all", query) },
          { key: "cumulative", label: "누적 기록", count: data.cumulativeStudentCount, href: reportHref("cumulative", query) },
          { key: "difficulty", label: "반복 어려움", count: data.repeatedDifficultyStudentCount, href: reportHref("difficulty", query) },
        ]}
      />

      <form
        method="get"
        role="search"
        className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 shadow-sm focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100"
      >
        {activeView !== "all" ? <input type="hidden" name="view" value={activeView} /> : null}
        <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <input
          name="q"
          defaultValue={query.q ?? ""}
          aria-label="학생 성장 리포트 검색"
          placeholder="학생, 활동명, 교과, 성취기준 검색"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted"
        />
        {query.q ? (
          <Link
            href={reportHref(activeView, { ...query, q: undefined })}
            className="shrink-0 px-2 text-xs font-bold text-muted hover:text-foreground"
          >
            지우기
          </Link>
        ) : null}
        <button
          type="submit"
          className="h-8 shrink-0 rounded-lg bg-foreground px-4 text-sm font-bold text-background"
        >
          검색
        </button>
      </form>

      {viewStudents.length === 0 ? (
        <EmptyState
          title={keyword ? "검색 결과가 없어요" : "표시할 승인 기록이 없어요"}
          description={
            keyword
              ? "학생 이름, 활동명, 교과 또는 성취기준으로 다시 검색해 보세요."
              : "평가관리에서 분석을 승인하면 학생별 기록이 이곳에 표시돼요."
          }
          ctaLabel={data.approvedRecordCount === 0 ? "평가관리로 이동" : undefined}
          ctaHref={data.approvedRecordCount === 0 ? "/analysis" : undefined}
        />
      ) : (
        <section className="space-y-3" aria-label="학생별 승인 학습 기록">
          {viewStudents.map((student) => {
            const latest = student.records.at(-1);
            const trend = TREND_LABEL[student.trend];
            return (
              <details
                key={student.studentId}
                className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]"
              >
                <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 md:px-6 [&::-webkit-details-marker]:hidden">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700">
                    {student.studentNumber}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-foreground">{student.studentName}</span>
                      <span className="text-xs font-medium text-muted">{student.className}</span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted">
                      {student.subjects.join(" · ")} · 승인 활동 {student.records.length}건
                      {latest?.achievementLevel ? ` · 최근 성취 ${latest.achievementLevel}` : ""}
                    </span>
                  </span>
                  <StatusBadge label={trend.label} tone={trend.tone} className="hidden sm:inline-flex" />
                  <ChevronDown className="h-5 w-5 shrink-0 text-muted transition group-open:rotate-180" />
                </summary>

                <div className="border-t border-line bg-background/50 px-5 py-5 md:px-6">
                  {student.approvedGrowthEvents.length > 0 ? (
                    <section className="mb-5 rounded-xl border border-success/20 bg-success-bg p-4" aria-label="교사 승인 성장 기록">
                      <h3 className="text-sm font-bold text-success">교사 승인 성장 기록</h3>
                      <ul className="mt-2 space-y-2 text-sm leading-6 text-foreground">
                        {student.approvedGrowthEvents.map((event) => (
                          <li key={event.id}>
                            {event.description}
                            <span className="ml-2 text-xs text-muted">{formatDate(event.createdAt)}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  <ol className="space-y-4" aria-label={`${student.studentName} 승인 활동 시간순 기록`}>
                    {student.records.map((record, index) => (
                      <li key={record.analysisId} className="rounded-xl border border-line bg-surface p-4 md:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                              {formatDate(record.observedAt)} · {index + 1}번째 승인 기록
                            </p>
                            <h3 className="mt-1 text-base font-bold text-foreground">{record.activityTitle}</h3>
                            <p className="mt-1 text-sm text-muted">
                              {[record.subject, record.domain, record.unit].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {record.achievementLevel ? (
                              <StatusBadge label={`성취 ${record.achievementLevel}`} tone="brand" />
                            ) : null}
                            {record.difficulties.some(({ isRepeatedError }) => isRepeatedError) ? (
                              <StatusBadge label="반복 어려움 관찰" tone="warning" />
                            ) : null}
                          </div>
                        </div>

                        {record.standards.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {record.standards.map((standard) => (
                              <span key={standard} className="rounded-full bg-neutral-bg px-2.5 py-1 text-xs font-semibold text-muted">
                                {standard}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <section className="rounded-xl bg-neutral-bg/60 p-4">
                            <h4 className="text-sm font-bold text-foreground">관찰된 강점</h4>
                            {record.strengths.length > 0 ? (
                              <ul className="mt-2 space-y-1.5 text-sm leading-6 text-muted">
                                {record.strengths.map((strength) => <li key={strength}>• {strength}</li>)}
                              </ul>
                            ) : <p className="mt-2 text-sm text-muted">기록된 강점이 없어요.</p>}
                          </section>
                          <section className="rounded-xl bg-neutral-bg/60 p-4">
                            <h4 className="text-sm font-bold text-foreground">관찰된 어려움</h4>
                            {record.difficulties.length > 0 ? (
                              <ul className="mt-2 space-y-1.5 text-sm leading-6 text-muted">
                                {record.difficulties.map((difficulty) => (
                                  <li key={difficulty.text}>
                                    • {difficulty.text}
                                    {difficulty.isRepeatedError ? <span className="ml-1 font-bold text-warning">(반복 관찰)</span> : null}
                                  </li>
                                ))}
                              </ul>
                            ) : <p className="mt-2 text-sm text-muted">기록된 어려움이 없어요.</p>}
                          </section>
                        </div>

                        <section className="mt-3 rounded-xl border border-line p-4">
                          <h4 className="text-sm font-bold text-foreground">승인 근거 {record.evidence.length}건</h4>
                          <ul className="mt-2 space-y-2 text-sm leading-6 text-muted">
                            {record.evidence.map((evidence) => (
                              <li key={evidence.id}>
                                {evidence.claim}
                                <span className="ml-2 text-xs text-muted/80">
                                  {[evidence.questionId, evidence.sourcePage ? `${evidence.sourcePage}쪽` : null]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </section>

                        {record.feedback ? (
                          <section className="mt-3 rounded-xl border border-brand-100 bg-brand-50/50 p-4">
                            <h4 className="text-sm font-bold text-brand-800">승인 피드백</h4>
                            <p className="mt-2 text-sm leading-6 text-foreground">{record.feedback}</p>
                          </section>
                        ) : null}

                        <div className="mt-4 flex justify-end">
                          <Link
                            href={`/analysis/${record.analysisId}/review`}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-bold text-foreground transition-colors hover:border-brand-300 hover:bg-brand-50"
                          >
                            {student.trend === "UP" ? <TrendingUp className="h-4 w-4 text-success" /> : student.trend === "DOWN" ? <TrendingDown className="h-4 w-4 text-warning" /> : <FileCheck2 className="h-4 w-4 text-brand-600" />}
                            승인 분석 보기
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </details>
            );
          })}
        </section>
      )}
    </div>
  );
}
