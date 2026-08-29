import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FolderOpen,
  Inbox,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/server";
import {
  loadReportIndexData,
  type StudentLearningTrend,
} from "@/lib/output/report-index-data";

export const metadata: Metadata = { title: "대시보드" };
export const dynamic = "force-dynamic";

const TREND_LABEL: Record<StudentLearningTrend, {
  label: string;
  tone: "success" | "info" | "warning" | "brand" | "neutral";
}> = {
  UP: { label: "성취 상승", tone: "success" },
  STABLE: { label: "수준 유지", tone: "info" },
  DOWN: { label: "추가 관찰", tone: "warning" },
  NEW: { label: "첫 기록", tone: "brand" },
  UNKNOWN: { label: "비교 대기", tone: "neutral" },
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(value));
}

/** 실제 DB 상태와 교사 승인 학생 기록만 집계하는 통합 대시보드. */
export default async function DashboardPage() {
  const hasSupabaseEnv = Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)
      && (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY),
  );

  let openAssignments = 0;
  let submissionCount = 0;
  let reviewPending = 0;
  let approvedCount = 0;
  let todos: Array<{ analysisId: string; label: string }> = [];
  let approvedAnalysesTotal = 0;
  let approvedStudentCount = 0;
  let cumulativeStudentCount = 0;
  let repeatedDifficultyStudentCount = 0;
  let improvedStudentCount = 0;
  let stableStudentCount = 0;
  let additionalObservationCount = 0;
  let levelDist: Array<{ level: string; count: number }> = [];
  let recentStudents: Array<{
    id: string;
    number: number;
    name: string;
    className: string;
    recordCount: number;
    latestLevel: string | null;
    latestDate: string;
    trend: StudentLearningTrend;
  }> = [];

  if (hasSupabaseEnv) {
    const supabase = await createClient();
    const [assignments, submissions, pending, approved, drafts, reportData] = await Promise.all([
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
      loadReportIndexData(),
    ]);

    openAssignments = assignments.count ?? 0;
    submissionCount = submissions.count ?? 0;
    reviewPending = pending.count ?? 0;
    approvedCount = approved.count ?? 0;

    /* Supabase relation inference can return a row or a one-row array. */
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const one = (value: any) => (Array.isArray(value) ? value[0] : value);
    todos = (drafts.data ?? []).map((draft: any) => {
      const submission = one(draft.submissions);
      const student = one(submission?.students);
      const activity = one(one(submission?.activity_assignments)?.activities);
      return {
        analysisId: draft.id as string,
        label: `${student ? `${student.student_number}번 ${student.name}` : "학생"} · ${activity?.title ?? "활동"}`,
      };
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    approvedAnalysesTotal = reportData.approvedRecordCount;
    approvedStudentCount = reportData.students.length;
    cumulativeStudentCount = reportData.cumulativeStudentCount;
    repeatedDifficultyStudentCount = reportData.repeatedDifficultyStudentCount;
    improvedStudentCount = reportData.students.filter(({ trend }) => trend === "UP").length;
    stableStudentCount = reportData.students.filter(({ trend }) => trend === "STABLE").length;
    additionalObservationCount = reportData.students.filter(({ trend }) => trend === "DOWN").length;

    const levelCounts = new Map<string, number>([["상", 0], ["중", 0], ["하", 0]]);
    for (const record of reportData.students.flatMap(({ records }) => records)) {
      if (record.achievementLevel && levelCounts.has(record.achievementLevel)) {
        levelCounts.set(record.achievementLevel, (levelCounts.get(record.achievementLevel) ?? 0) + 1);
      }
    }
    levelDist = ["상", "중", "하"].map((level) => ({ level, count: levelCounts.get(level) ?? 0 }));

    recentStudents = reportData.students
      .flatMap((student) => {
        const latest = student.records.at(-1);
        return latest ? [{
          id: student.studentId,
          number: student.studentNumber,
          name: student.studentName,
          className: student.className,
          recordCount: student.records.length,
          latestLevel: latest.achievementLevel,
          latestDate: latest.observedAt,
          trend: student.trend,
        }] : [];
      })
      .sort((left, right) => right.latestDate.localeCompare(left.latestDate) || left.number - right.number)
      .slice(0, 6);
  }

  return (
    <div className="space-y-6">
      <div className="animate-rise">
        <PageHeader
          title="오늘의 TRACE"
          description="학급의 제출·검토 현황과 승인된 학생 학습 기록을 확인하세요."
        />
      </div>

      <section className="animate-rise grid grid-cols-2 gap-4 lg:grid-cols-4" style={{ animationDelay: "0.08s" }}>
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
          hint={reviewPending === 0 ? "검토할 분석이 없어요" : "교사 검토 필요"}
        />
        <StatCard
          label="승인 완료"
          value={approvedCount}
          tone="brand"
          icon={<CheckCircle2 className="h-4.5 w-4.5" />}
          href="/analysis?tab=approved"
          hint={approvedCount === 0 ? "승인된 분석이 없어요" : "확정된 학습 기록"}
        />
      </section>

      <section className="animate-rise space-y-3" style={{ animationDelay: "0.16s" }}>
        <h2 className="text-lg font-bold text-foreground">지금 할 일</h2>
        {todos.length === 0 ? (
          <EmptyState
            title="지금 처리할 일이 없어요"
            description="학습자료를 추가하면 검토할 분석이 여기에 모여요."
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
                    <span className="block truncate text-sm font-semibold text-foreground">{todo.label}</span>
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

      <section className="animate-rise space-y-3" style={{ animationDelay: "0.24s" }}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-foreground">우리 반 학습 과정</h2>
            <p className="mt-1 text-sm text-muted">교사가 승인한 학생별 활동 기록만 집계합니다.</p>
          </div>
          {approvedAnalysesTotal > 0 ? (
            <Link href="/reports" className="text-sm font-bold text-brand-700 hover:text-brand-800">
              학생별 기록 보기
            </Link>
          ) : null}
        </div>

        {approvedAnalysesTotal === 0 ? (
          <EmptyState
            title="아직 승인된 학생 기록이 없어요"
            description="평가관리에서 분석을 승인하면 학생별 누적 과정이 표시돼요."
            ctaLabel="평가관리로 이동"
            ctaHref="/analysis"
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-bold text-foreground">승인 활동의 성취수준</h3>
                <span className="text-xs text-muted">학생 활동 {approvedAnalysesTotal}건 기준</span>
              </div>
              <ul className="mt-5 space-y-4">
                {levelDist.map(({ level, count }) => {
                  const max = Math.max(1, ...levelDist.map((item) => item.count));
                  const width = count === 0 ? 0 : Math.max(5, Math.round((count / max) * 100));
                  return (
                    <li key={level} className="grid grid-cols-[2rem_minmax(0,1fr)_3.5rem] items-center gap-3">
                      <span className="text-sm font-bold text-foreground">{level}</span>
                      <span className="h-3 overflow-hidden rounded-full bg-neutral-bg">
                        <span className="block h-full rounded-full bg-brand-600" style={{ width: `${width}%` }} />
                      </span>
                      <span className="text-right text-sm font-bold tabular-nums text-foreground">{count}건</span>
                    </li>
                  );
                })}
              </ul>
            </article>

            <article className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">학생별 누적 변화</h3>
                  <p className="mt-1 text-xs text-muted">첫 승인 기록과 최근 승인 기록을 비교한 학생 수예요.</p>
                </div>
                <UserRound className="h-5 w-5 text-brand-600" aria-hidden="true" />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-neutral-bg/60 p-3">
                  <dt className="text-xs font-semibold text-muted">기록 학생</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-foreground">{approvedStudentCount}명</dd>
                </div>
                <div className="rounded-xl bg-neutral-bg/60 p-3">
                  <dt className="text-xs font-semibold text-muted">2회 이상 누적</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-foreground">{cumulativeStudentCount}명</dd>
                </div>
                <div className="rounded-xl bg-success-bg p-3">
                  <dt className="text-xs font-semibold text-success">성취 상승 관찰</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-success">{improvedStudentCount}명</dd>
                </div>
                <div className="rounded-xl bg-info-bg p-3">
                  <dt className="text-xs font-semibold text-info">성취 수준 유지</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-info">{stableStudentCount}명</dd>
                </div>
                <div className="rounded-xl bg-warning-bg p-3">
                  <dt className="text-xs font-semibold text-warning">추가 관찰 필요</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-warning">{additionalObservationCount}명</dd>
                </div>
                <div className="rounded-xl bg-warning-bg p-3">
                  <dt className="text-xs font-semibold text-warning">반복 어려움 관찰</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-warning">{repeatedDifficultyStudentCount}명</dd>
                </div>
              </dl>
            </article>
          </div>
        )}
      </section>

      {recentStudents.length > 0 ? (
        <section className="animate-rise space-y-3" style={{ animationDelay: "0.32s" }}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-foreground">최근 학생 기록</h2>
            <BookOpenCheck className="h-5 w-5 text-brand-600" aria-hidden="true" />
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
            {recentStudents.map((student) => {
              const trend = TREND_LABEL[student.trend];
              return (
                <li key={student.id}>
                  <Link
                    href={`/reports?q=${encodeURIComponent(student.name)}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-brand-50/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                      {student.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-bold text-foreground">{student.name}</span>
                      <span className="ml-2 text-xs text-muted">{student.className}</span>
                      <span className="mt-1 block text-xs text-muted">
                        승인 활동 {student.recordCount}건
                        {student.latestLevel ? ` · 최근 성취 ${student.latestLevel}` : ""}
                        {` · ${formatDate(student.latestDate)}`}
                      </span>
                    </span>
                    <StatusBadge label={trend.label} tone={trend.tone} className="hidden sm:inline-flex" />
                    <ChevronRight className="h-4 w-4 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
