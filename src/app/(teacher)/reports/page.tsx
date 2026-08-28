import type { Metadata } from "next";
import type { ComponentProps } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Braces,
  ClipboardCheck,
  FileText,
  Gauge,
  Layers3,
  Link2,
  PencilLine,
  Quote,
  School,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NeisDraftPanel } from "@/features/reports/NeisDraftPanel";
import { ReportReadyState } from "@/features/reports/ReportReadyState";
import { NEIS_GUIDELINE_METADATA } from "@/lib/output/neis-draft";
import { loadLatestReportPageData } from "@/lib/output/report-page-data";
import {
  ANALYSIS_STATUS_LABEL,
  INPUT_STATUS_LABEL,
  PROCESS_STATUS_LABEL,
} from "@/shared/types/status";
import styles from "@/features/reports/report-experience.module.css";

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
  const label: Record<string, string> = {
    marked_parts: "표시한 부분",
    total_parts: "전체 부분",
    written_expression: "학생 기록",
    raw_text: "학생 응답",
  };

  return Object.entries(response)
    .map(([key, value]) => `${label[key] ?? key}: ${String(value)}`)
    .join(" · ");
}

export default async function ReportsPage() {
  const { report, stats } = await loadLatestReportPageData();

  if (!report) {
    return <ReportReadyState stats={stats} />;
  }

  const approvedTimepoints = report.timepoints.map((timepoint) => ({
    timepoint,
    selectedAnalysis: timepoint.analysis,
  }));

  const sourceLinks = report.timepoints.map(({ artifact, evidence }) => ({
    href: artifact.source_url,
    page: evidence.source_page,
    id: artifact.id,
  }));

  const reportJourney = [
    { index: "01", label: "INPUT", detail: "학생 산출물과 관찰 가능한 응답" },
    { index: "02", label: "PROCESS", detail: "교사가 승인한 분석과 Evidence" },
    { index: "03", label: "OUTPUT", detail: "근거로 추적되는 성장 기록" },
    { index: "04", label: "TEACHER DRAFT", detail: "교사가 수정하는 생기부 기록 제안" },
  ];

  return (
    <article id="report-print-root" className="space-y-8">
      <header className={`${styles.cover} px-5 py-8 sm:px-8 sm:py-10 xl:px-10 xl:py-12`}>
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)] xl:items-center">
          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm print:border-line print:bg-surface print:text-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                실제 입력 · 승인 Evidence 전용
              </span>
              <span className="rounded-full border border-white/15 px-3 py-1.5 font-display text-xs font-semibold text-brand-100 print:border-line print:text-muted">
                실시간 DB 반영
              </span>
            </div>
            <p className="mt-7 font-display text-xs font-bold tracking-[0.2em] text-brand-200 print:text-brand-700">
              TRACE LEARNING GROWTH REPORT
            </p>
            <h1 className="mt-3 max-w-4xl text-[clamp(2rem,4vw,3.5rem)] font-extrabold leading-[1.08] tracking-[-0.035em] text-white print:text-foreground">
              {report.timepoints.length}번의 관찰이
              <span className="block text-brand-200 print:text-brand-700">한 문장의 성장 기록이 되기까지</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-brand-100 print:text-muted">
              원본 산출물에서 교사 승인 Evidence, 성장 기록, 생기부 제안까지 이어지는 근거의 전체 경로를
              한 화면에서 확인합니다.
            </p>
            <dl className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-brand-100 print:text-muted">
              <div className="flex items-center gap-2">
                <School className="h-4 w-4" aria-hidden="true" />
                <dt className="sr-only">학생</dt>
                <dd>
                  {report.student.student_number}번 {report.student.name}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4" aria-hidden="true" />
                <dt className="sr-only">교과</dt>
                <dd>{report.subject_label}</dd>
              </div>
            </dl>
          </div>

          <ol className={`${styles.chain} relative z-10 space-y-3`} aria-label="리포트 Evidence 체인">
            {reportJourney.map((item) => (
              <li key={item.index} className={`${styles.chainItem} ml-0 flex gap-4 rounded-2xl p-4 pl-14`}>
                <span className="absolute left-[0.45rem] flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-[var(--report-ink)] font-display text-xs font-bold text-white shadow-sm print:border-line print:bg-surface print:text-foreground">
                  {item.index}
                </span>
                <div>
                  <p className="font-display text-xs font-bold tracking-[0.14em] text-brand-200 print:text-brand-700">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-white print:text-foreground">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-[1.25fr_0.75fr_0.75fr]" aria-label="리포트 핵심 지표">
        <article className={`${styles.metricFeature} print-break-inside-avoid rounded-2xl p-5 text-white print:border print:border-line print:text-foreground`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.14em] text-brand-200 print:text-brand-700">EVIDENCE COVERAGE</p>
              <p className="mt-3 font-display text-4xl font-extrabold tabular-nums">100%</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-brand-100 print:text-muted">
                표시 중인 성장 기록은 승인 Evidence와 보호된 원본 산출물 연결을 모두 갖춥니다.
              </p>
            </div>
            <Gauge className="h-7 w-7 text-brand-200 print:text-brand-700" aria-hidden="true" />
          </div>
        </article>
        <article className="print-break-inside-avoid rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <TrendingUp className="h-6 w-6 text-info" aria-hidden="true" />
          <p className="mt-5 font-display text-3xl font-extrabold tabular-nums text-foreground">
            {report.timepoints.length}회
          </p>
          <p className="mt-1 text-sm font-semibold text-muted">서로 다른 날짜의 관찰</p>
        </article>
        <article className="print-break-inside-avoid rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <ClipboardCheck className="h-6 w-6 text-success" aria-hidden="true" />
          <p className="mt-5 font-display text-3xl font-extrabold tabular-nums text-foreground">
            {report.growthEventEvidence.length}건
          </p>
          <p className="mt-1 text-sm font-semibold text-muted">교사 승인 Evidence</p>
        </article>
      </section>

      <section
        aria-label="실제 데이터 범위 안내"
        className="no-print flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-brand-200 bg-brand-50/70 p-5"
      >
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">교사 승인 데이터만 반영</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
              현재 교사 계정에서 확인 가능한 실제 입력 가운데 승인된 분석과 Evidence만 표시합니다.
              생기부 제안은 원본 근거를 대조하고 교사가 수정한 뒤에만 복사하거나 PDF로 저장할 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      <ol className="space-y-6" aria-label="INPUT PROCESS OUTPUT 교사 기록 제안 흐름">
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

          <section
            aria-labelledby="input-heading"
            className={`${styles.stageSurface} ${styles.stageInput} print-break-inside-avoid rounded-2xl border border-line bg-surface p-5 pl-6 shadow-[var(--shadow-card)]`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="input-heading" className="text-lg font-bold text-foreground">
                  원본 학생 산출물과 구조화 입력
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {report.student.student_number}번 {report.student.name}의 실제 활동 기록
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
                      {report.timepoints[0].artifact.file_name}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {sourceLinks.map(({ href, page, id }) =>
                    href ? (
                      <a
                        key={id}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-brand-300 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-300"
                      >
                        <Link2 className="h-4 w-4 text-brand-600" aria-hidden="true" />
                        원본 PDF {page ? `${page}쪽 ` : ""}열기
                      </a>
                    ) : (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-neutral-bg px-3 py-2 text-sm font-semibold text-muted"
                      >
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        보호 원본 · 링크 준비 중
                      </span>
                    ),
                  )}
                </div>
              </article>

              <div className="grid gap-3 sm:grid-cols-2">
                {report.timepoints.map(({ date, activity, submission }) => {
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
                            <dt className="font-semibold text-foreground">
                              {question.response_type === "work_sample" ? "학생 산출물" : question.response_type}
                            </dt>
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

          <section
            aria-labelledby="process-heading"
            className={`${styles.stageSurface} ${styles.stageProcess} rounded-2xl border border-line bg-surface p-5 pl-6 shadow-[var(--shadow-card)]`}
          >
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
                        Evidence · {timepoint.evidence.source_page ? `원본 ${timepoint.evidence.source_page}쪽` : "원본 연결"}
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

          <section
            aria-labelledby="output-heading"
            className={`${styles.stageSurface} ${styles.stageOutput} print-break-inside-avoid rounded-2xl border border-success/30 bg-success-bg/45 p-5 pl-6 shadow-[var(--shadow-card)]`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success text-white shadow-sm">
                  <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="output-heading" className="text-lg font-bold text-foreground">
                    승인 근거 기반 성장 기록
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    승인 Evidence {report.growthEventEvidence.length}건이 연결된 GrowthEvent입니다.
                  </p>
                </div>
              </div>
              <ReportStatusBadge label="성장 기록 승인" tone="success" />
            </div>

            <p className="mt-5 max-w-3xl text-base leading-7 text-foreground">
              {report.growthEvent.description}
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
              교사 승인 Evidence {report.growthEventEvidence.length}건 연결
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              성장 기록 확정
            </div>
          </section>
        </li>

        <li className="grid gap-4 lg:grid-cols-[9rem_minmax(0,1fr)]">
          <div className="flex items-start gap-3 lg:flex-col lg:gap-1 lg:pt-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning text-sm font-black text-white shadow-sm">
              04
            </span>
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-warning">TEACHER DRAFT</p>
              <p className="mt-1 text-sm font-semibold text-foreground">기록 제안</p>
            </div>
          </div>

          <section
            aria-labelledby="record-heading"
            className={`${styles.stageSurface} ${styles.stageRecord} rounded-3xl bg-transparent pl-1`}
          >
            <h2 id="record-heading" className="sr-only">
              교사 검토용 나이스 생기부 기록 제안
            </h2>
            <NeisDraftPanel
              initialDraft={report.neisDraft}
              sourceLabel={`${NEIS_GUIDELINE_METADATA.sourceLabel} · ${NEIS_GUIDELINE_METADATA.applicableYear}학년도 ${NEIS_GUIDELINE_METADATA.schoolLevel}`}
              recordArea={NEIS_GUIDELINE_METADATA.recordArea}
              evidence={approvedTimepoints.map(({ timepoint }, index) => ({
                id: timepoint.evidence.id,
                label: `승인 Evidence ${index + 1}`,
                claim: timepoint.evidence.claim,
                href: timepoint.artifact.source_url,
              }))}
            />
          </section>
        </li>
      </ol>
    </article>
  );
}
