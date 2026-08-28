import type { Metadata } from "next";
import type { ComponentProps } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Braces,
  FileText,
  Link2,
  PencilLine,
  Quote,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  activityReportDemo,
  selectApprovedOutputAnalyses,
  validateActivityReportDemo,
} from "@/lib/output/activity-report-demo";
import {
  ANALYSIS_STATUS_LABEL,
  INPUT_STATUS_LABEL,
  PROCESS_STATUS_LABEL,
} from "@/shared/types/status";

export const metadata: Metadata = { title: "리포트" };

type ReportStatusBadgeProps = ComponentProps<typeof StatusBadge>;

function ReportStatusBadge({ className, ...props }: ReportStatusBadgeProps) {
  return (
    <span className="inline-flex [&>span]:!text-foreground">
      <StatusBadge {...props} className={className} />
    </span>
  );
}

function formatObservedDate(date: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00+09:00`));
}

function getObservation(analysisJson: Record<string, unknown>) {
  const observation = analysisJson.observation;

  if (typeof observation !== "string") {
    throw new Error("Approved demo analysis requires an observation.");
  }

  return observation;
}

function getResponseSummary(response: Record<string, unknown>) {
  return Object.entries(response)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

export default function ReportsPage() {
  if (!validateActivityReportDemo(activityReportDemo)) {
    throw new Error("The synthetic activity report demo failed its contract validation.");
  }

  const approvedTimepoints = activityReportDemo.timepoints.flatMap((timepoint) => {
    const selectedAnalyses = selectApprovedOutputAnalyses(
      timepoint.submission.structured_input,
      timepoint.analyses,
    );
    const selectedAnalysis = selectedAnalyses.find((analysis) => analysis.id === timepoint.analysis.id);

    return selectedAnalysis ? [{ timepoint, selectedAnalysis }] : [];
  });

  if (approvedTimepoints.length !== activityReportDemo.timepoints.length) {
    throw new Error("The report requires one selected approved analysis for each observation.");
  }

  const sourceLinks = activityReportDemo.timepoints.map(({ artifact, evidence }) => ({
    href: `/${artifact.storage_path}#page=${evidence.source_page}`,
    page: evidence.source_page,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="학습 성장 리포트"
        description="관찰된 입력과 교사 승인 근거가 성장 기록으로 이어지는 과정을 확인해요."
        actions={<ReportStatusBadge label="합성 데이터 데모" tone="brand" />}
      />

      <section
        aria-label="데모 범위 안내"
        className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-brand-200 bg-brand-50/70 p-5"
      >
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">합성 데이터 데모</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
              학생 1명의 두 번의 관찰을 사용한 읽기 전용 수직 흐름입니다. OUTPUT에는 교사가 승인한
              분석과 그 분석에 연결된 Evidence만 표시됩니다.
            </p>
          </div>
        </div>
        <p className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm">
          {activityReportDemo.contract_version}
        </p>
      </section>

      <ol className="space-y-6" aria-label="INPUT PROCESS OUTPUT 흐름">
        <li className="grid gap-4 lg:grid-cols-[9rem_minmax(0,1fr)]">
          <div className="flex items-start gap-3 lg:flex-col lg:gap-1 lg:pt-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-black text-white shadow-sm">
              01
            </span>
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-brand-600">INPUT</p>
              <p className="mt-1 text-sm font-semibold text-foreground">관찰 자료</p>
            </div>
          </div>

          <section aria-labelledby="input-heading" className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="input-heading" className="text-lg font-bold text-foreground">
                  원본 PDF와 구조화 입력
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {activityReportDemo.student.student_number}번 {activityReportDemo.student.name}의 두 활동 기록
                </p>
              </div>
              <ReportStatusBadge label="입력 확인 완료" tone="success" />
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.2fr)]">
              <article className="rounded-xl border border-line bg-background p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-bg text-warning">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">원본 활동지 PDF</h3>
                    <p className="mt-1 truncate text-sm text-muted">
                      {activityReportDemo.timepoints[0].artifact.file_name}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {sourceLinks.map(({ href, page }) => (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-brand-300 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-300"
                    >
                      <Link2 className="h-4 w-4 text-brand-600" aria-hidden="true" />
                      원본 PDF {page}쪽 열기
                    </a>
                  ))}
                </div>
              </article>

              <div className="grid gap-3 sm:grid-cols-2">
                {activityReportDemo.timepoints.map(({ date, activity, submission }) => {
                  const inputStatus = INPUT_STATUS_LABEL[submission.input_status];
                  const processStatus = PROCESS_STATUS_LABEL[submission.process_status];

                  return (
                    <article key={submission.id} className="rounded-xl border border-line bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-muted">{formatObservedDate(date)}</p>
                          <h3 className="mt-1 font-semibold text-foreground">{activity.title}</h3>
                        </div>
                        <Braces className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <ReportStatusBadge label={inputStatus.label} tone={inputStatus.tone} />
                        <ReportStatusBadge label={processStatus.label} tone={processStatus.tone} />
                      </div>
                      <dl className="mt-4 space-y-2 text-sm">
                        {submission.structured_input.questions.map((question) => (
                          <div key={question.question_id} className="rounded-lg bg-neutral-bg p-3">
                            <dt className="font-semibold text-foreground">{question.response_type}</dt>
                            <dd className="mt-1 break-words leading-5 text-muted">
                              {getResponseSummary(question.response)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        </li>

        <li className="grid gap-4 lg:grid-cols-[9rem_minmax(0,1fr)]">
          <div className="flex items-start gap-3 lg:flex-col lg:gap-1 lg:pt-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-info text-sm font-black text-white shadow-sm">
              02
            </span>
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-info">PROCESS</p>
              <p className="mt-1 text-sm font-semibold text-foreground">교사 검토</p>
            </div>
          </div>

          <section aria-labelledby="process-heading" className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="process-heading" className="text-lg font-bold text-foreground">
                  선택된 분석과 Evidence
                </h2>
                <p className="mt-1 text-sm text-muted">교사 검토를 통과한 분석만 다음 단계로 연결합니다.</p>
              </div>
              <ReportStatusBadge label="승인 근거만 표시" tone="success" />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {approvedTimepoints.map(({ timepoint, selectedAnalysis }) => {
                const analysisStatus = ANALYSIS_STATUS_LABEL[selectedAnalysis.status];

                return (
                  <article key={selectedAnalysis.id} className="rounded-xl border border-line bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-muted">{formatObservedDate(timepoint.date)}</p>
                        <h3 className="mt-1 font-semibold text-foreground">{timepoint.activity.title}</h3>
                      </div>
                      <ReportStatusBadge label={analysisStatus.label} tone={analysisStatus.tone} />
                    </div>

                    <div className="mt-4 rounded-xl border border-info/20 bg-info-bg/50 p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-info">
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        선택된 분석
                      </div>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {getObservation(selectedAnalysis.analysis_json)}
                      </p>
                    </div>

                    <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/70 p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                        <Quote className="h-4 w-4" aria-hidden="true" />
                        Evidence · 원본 {timepoint.evidence.source_page}쪽
                      </div>
                      <p className="mt-2 text-sm leading-6 text-foreground">{timepoint.evidence.claim}</p>
                    </div>

                    <div className="mt-3 flex gap-2 rounded-xl bg-neutral-bg p-3 text-sm leading-6 text-muted">
                      {timepoint.review.teacher_edits ? (
                        <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                      ) : (
                        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      )}
                      <div>
                        <p className="font-semibold text-foreground">
                          {timepoint.review.teacher_edits ? "교사 피드백 수정" : "교사 승인"}
                        </p>
                        {timepoint.review.teacher_edits ? (
                          <p className="mt-1">{timepoint.review.teacher_edits.feedback_after}</p>
                        ) : (
                          <p className="mt-1">분석과 Evidence 연결을 교사가 확인했습니다.</p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </li>

        <li className="grid gap-4 lg:grid-cols-[9rem_minmax(0,1fr)]">
          <div className="flex items-start gap-3 lg:flex-col lg:gap-1 lg:pt-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success text-sm font-black text-white shadow-sm">
              03
            </span>
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-success">OUTPUT</p>
              <p className="mt-1 text-sm font-semibold text-foreground">성장 기록</p>
            </div>
          </div>

          <section aria-labelledby="output-heading" className="rounded-2xl border border-success/30 bg-success-bg/45 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success text-white shadow-sm">
                  <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="output-heading" className="text-lg font-bold text-foreground">
                    승인 근거 기반 성장 기록
                  </h2>
                  <p className="mt-1 text-sm text-muted">두 Evidence가 모두 연결된 GrowthEvent입니다.</p>
                </div>
              </div>
              <ReportStatusBadge label="성장 기록 승인" tone="success" />
            </div>

            <p className="mt-5 max-w-3xl text-base leading-7 text-foreground">
              {activityReportDemo.growthEvent.description}
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              {approvedTimepoints.map(({ timepoint }, index) => (
                <div key={timepoint.evidence.id} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-success/20 bg-surface p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-bg text-xs font-black text-success">
                    {index + 1}
                  </span>
                  <p className="min-w-0 text-sm leading-5 text-foreground">{timepoint.evidence.claim}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm font-semibold text-success">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              교사 승인 Evidence {activityReportDemo.growthEventEvidence.length}건 연결
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              성장 기록 확정
            </div>
          </section>
        </li>
      </ol>
    </div>
  );
}
