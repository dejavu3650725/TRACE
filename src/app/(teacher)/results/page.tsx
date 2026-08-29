import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Clock3, Eye, FileText, FolderOpen, Search, Upload } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TabNav } from "@/components/ui/TabNav";
import {
  buildActivityResultCards,
  filterActivityResultCardsByTab,
  type ActivityResultAssignment,
  type ActivityResultInputStatus,
  type ActivityResultSubmission,
} from "@/features/results/activity-results";
import { ReadyAnalysisButton } from "@/features/process/ReadyAnalysisButton";
import { requireSessionTeacher } from "@/lib/auth/teacher";

export const metadata: Metadata = { title: "학습관리" };
export const dynamic = "force-dynamic";

type ResultTab = "all" | "review" | "ready";

type ResultsSearchParams = {
  tab?: string;
  q?: string;
};

const INPUT_STATUS_LABEL: Record<ActivityResultInputStatus, string> = {
  UPLOADING: "업로드 중",
  STORED: "원본 저장",
  PREPROCESSING: "전처리 중",
  STRUCTURING: "응답 구성 중",
  REVIEW_PENDING: "검토 대기",
  READY_FOR_PROCESS: "분석 준비",
  FAILED: "입력 실패",
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function resultTab(value: string | undefined): ResultTab {
  return value === "review" || value === "ready" ? value : "all";
}

function statusForSubmission(submission: ActivityResultSubmission): {
  label: string;
  tone: "neutral" | "info" | "warning" | "success" | "danger" | "brand";
} {
  if (submission.inputStatus === "REVIEW_PENDING") {
    return { label: "검토 대기", tone: "warning" };
  }
  if (submission.inputStatus === "READY_FOR_PROCESS") {
    return ["NOT_STARTED", "READY_TO_ANALYZE"].includes(submission.processStatus)
      ? { label: "분석 준비", tone: "brand" }
      : { label: "분석 전달 완료", tone: "success" };
  }
  if (submission.inputStatus === "FAILED") return { label: "입력 실패", tone: "danger" };
  return { label: INPUT_STATUS_LABEL[submission.inputStatus], tone: "neutral" };
}

function tabHref(tab: ResultTab, query: ResultsSearchParams): string {
  const params = new URLSearchParams();
  if (tab !== "all") params.set("tab", tab);
  if (query.q?.trim()) params.set("q", query.q.trim());
  const encoded = params.toString();
  return encoded ? `/results?${encoded}` : "/results";
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<ResultsSearchParams>;
}) {
  const query = await searchParams;
  const activeTab = resultTab(query.tab);
  const { supabase } = await requireSessionTeacher();
  const { data, error } = await supabase
    .from("activity_assignments")
    .select(`
      id, class_id, created_at,
      activities!inner(
        id, title, activity_code, grade, subject, domain,
        activity_standards(standard_id)
      ),
      classes!inner(
        id, name,
        students(id, student_number, name, is_active)
      ),
      submissions(
        id, student_id, input_status, process_status, submitted_at, updated_at,
        artifacts(id)
      )
    `)
    .neq("status", "ARCHIVED")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Activity-centered results lookup failed", { cause: error });

  /* Supabase relation inference can return a row or a one-row array. */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const assignments: ActivityResultAssignment[] = (data ?? []).flatMap((row: any) => {
    const activity = one(row.activities as any);
    const classItem = one(row.classes as any);
    if (!activity || !classItem) return [];
    return [{
      assignmentId: row.id,
      activityId: activity.id,
      title: activity.title,
      activityCode: activity.activity_code,
      grade: activity.grade,
      subject: activity.subject,
      domain: activity.domain,
      standardIds: (activity.activity_standards ?? []).map((standard: any) => standard.standard_id),
      classId: row.class_id,
      className: classItem.name,
      createdAt: row.created_at,
      students: (classItem.students ?? [])
        .filter((student: any) => student.is_active)
        .map((student: any) => ({
          id: student.id,
          studentNumber: student.student_number,
          studentName: student.name,
        }))
        .sort((left: any, right: any) => left.studentNumber - right.studentNumber),
      submissions: (row.submissions ?? []).map((submission: any) => ({
        id: submission.id,
        studentId: submission.student_id,
        inputStatus: submission.input_status,
        processStatus: submission.process_status,
        submittedAt: submission.submitted_at,
        updatedAt: submission.updated_at,
        artifactCount: submission.artifacts?.length ?? 0,
      })),
    }];
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const allCards = buildActivityResultCards(assignments, { keyword: query.q });
  const cards = filterActivityResultCardsByTab(allCards, activeTab);

  return (
    <div className="space-y-6">
      <PageHeader
        title="학습관리"
        description="활동별로 학생 제출 현황을 확인하고, 같은 학생의 누적 활동을 이어서 관리해요."
        actions={<Link href="/results/upload" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700"><Upload className="h-4 w-4" /> 활동자료 업로드</Link>}
      />

      <TabNav
        activeKey={activeTab}
        items={[
          { key: "all", label: "전체", count: allCards.reduce((sum, card) => sum + card.submitted, 0), href: tabHref("all", query) },
          { key: "review", label: "검토 대기", count: allCards.reduce((sum, card) => sum + card.reviewPending, 0), href: tabHref("review", query) },
          { key: "ready", label: "분석 준비", count: allCards.reduce((sum, card) => sum + card.readyForProcess, 0), href: tabHref("ready", query) },
        ]}
      />

      <form method="get" role="search" className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 shadow-sm focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
        {activeTab !== "all" ? <input type="hidden" name="tab" value={activeTab} /> : null}
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input name="q" defaultValue={query.q ?? ""} aria-label="학습 활동 검색" placeholder="교과 또는 활동명 검색 · 예: 국어, 수학, 문단" className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted" />
        {query.q ? <Link href={tabHref(activeTab, { ...query, q: undefined })} className="shrink-0 px-2 text-xs font-bold text-muted hover:text-foreground">지우기</Link> : null}
        <button type="submit" className="h-8 shrink-0 rounded-lg bg-foreground px-4 text-sm font-bold text-background">검색</button>
      </form>

      {cards.length > 0 ? (
          <section className="space-y-4" aria-label="활동별 학습결과">
            {cards.map((card, cardIndex) => {
              const readySubmissionIds = card.rows.flatMap(({ submission }) => (
                submission
                && submission.inputStatus === "READY_FOR_PROCESS"
                && ["NOT_STARTED", "READY_TO_ANALYZE", "FAILED"].includes(submission.processStatus)
                  ? [submission.id]
                  : []
              ));
              return (
            <details key={card.assignmentId} open={cardIndex === 0} className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
              <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-5 md:px-6 [&::-webkit-details-marker]:hidden">
                <span className="rounded-xl bg-amber-50 p-3 text-amber-600"><FolderOpen className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted"><span className="rounded-full bg-neutral-bg px-2.5 py-1 font-mono">{card.activityCode ?? "활동 코드 미발급"}</span><span className="text-brand-700">{card.className}</span><span>{[card.grade ? `${card.grade}학년` : null, card.subject, card.domain].filter(Boolean).join(" · ")}</span></span>
                  <span className="mt-2 block truncate text-lg font-bold text-foreground">{card.title}</span>
                </span>
                <span className="hidden rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-bold text-brand-700 sm:inline">제출 {card.submitted}/{card.total}</span>
                <ChevronDown className="h-5 w-5 text-muted transition group-open:rotate-180" />
              </summary>
              <div className="border-t border-border bg-background/60 px-5 py-5 md:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-neutral-bg px-3 py-1.5 text-muted">미제출 {card.missing}</span>
                    <span className="rounded-full bg-warning-bg px-3 py-1.5 text-warning">검토 {card.reviewPending}</span>
                    <span className="rounded-full bg-brand-50 px-3 py-1.5 text-brand-700">분석 준비 {card.readyForProcess}</span>
                  </div>
                  {readySubmissionIds.length > 0 ? <ReadyAnalysisButton submissionIds={readySubmissionIds} /> : null}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {card.rows.map(({ student, submission }) => {
                    if (!submission) {
                      return (
                        <article key={student.id} className="rounded-xl border border-dashed border-border bg-surface p-4">
                          <div className="flex items-center justify-between gap-3"><p className="font-bold text-foreground"><span className="mr-2 text-brand-700">{student.studentNumber}</span>{student.studentName}</p><StatusBadge label="미제출" tone="neutral" /></div>
                          <p className="mt-3 text-xs text-muted">이 활동의 제출물이 아직 없습니다.</p>
                        </article>
                      );
                    }
                    const status = statusForSubmission(submission);
                    return (
                      <Link key={submission.id} href={`/results/${submission.id}`} className="rounded-xl border border-border bg-surface p-4 transition hover:border-brand-300 hover:shadow-sm">
                        <div className="flex items-center justify-between gap-3"><p className="font-bold text-foreground"><span className="mr-2 text-brand-700">{student.studentNumber}</span>{student.studentName}</p><StatusBadge label={status.label} tone={status.tone} /></div>
                        <div className="mt-3 flex items-center gap-3 text-xs text-muted"><span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> 파일 {submission.artifactCount}개</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(submission.submittedAt ?? submission.updatedAt))}</span></div>
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-700">결과물 상세 보기 <Eye className="h-3.5 w-3.5" /></span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </details>
              );
            })}
          </section>
      ) : (
        <EmptyState icon={<FolderOpen className="h-6 w-6" />} title="검색 결과가 없어요" description="다른 교과나 활동 키워드로 검색해 보세요." ctaLabel="활동자료 업로드" ctaHref="/results/upload" />
      )}
    </div>
  );
}
