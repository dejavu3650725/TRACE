"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, CheckCircle2, ExternalLink, Link2, LoaderCircle, RefreshCw, Save, ShieldAlert, Sparkles, XCircle } from "lucide-react";
import { createTeacherArtifactSignedUrl } from "./actions";
import {
  classifyTeacherBatchActivity,
  confirmTeacherBatchActivity,
  correctTeacherBatchReview,
  matchTeacherBatchPdf,
  replaceTeacherBatchPageRanges,
  type ClassifyTeacherBatchActivityResult,
  type MatchTeacherBatchResult,
} from "./batch-actions";
import { groupBatchPagesByStudent, type BatchPageRange } from "./batch-ranges";

type SavedRange = BatchPageRange & { id?: string; submissionId?: string | null };

export type BatchMatchAssignmentOption = {
  id: string;
  classId: string;
  label: string;
  students: Array<{
    id: string;
    studentNumber: number;
    studentName: string;
  }>;
};

export type BatchActivityClassOption = {
  id: string;
  label: string;
  students: BatchMatchAssignmentOption["students"];
};

export function BatchPdfInspectionPanel({
  artifactId,
  fileName,
  pageCount,
  initialSignedUrl,
  initialRanges,
  initialReviewSubmissionIds,
  assignments,
  classes,
}: {
  artifactId: string;
  fileName: string;
  pageCount: number;
  initialSignedUrl: string;
  initialRanges: (BatchPageRange & { id: string; submissionId: string | null })[];
  initialReviewSubmissionIds: string[];
  assignments: BatchMatchAssignmentOption[];
  classes: BatchActivityClassOption[];
}) {
  const router = useRouter();
  const [signedUrl, setSignedUrl] = useState(initialSignedUrl);
  const [selectedPage, setSelectedPage] = useState(1);
  const [ranges, setRanges] = useState<SavedRange[]>(
    initialRanges.length > 0
      ? initialRanges
      : groupBatchPagesByStudent(pageCount, 1),
  );
  const [matching, setMatching] = useState(false);
  const [correctingRangeId, setCorrectingRangeId] = useState<string | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [availableAssignments, setAvailableAssignments] = useState(assignments);
  const [assignmentId, setAssignmentId] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [classifyingActivity, setClassifyingActivity] = useState(false);
  const [confirmingActivity, setConfirmingActivity] = useState(false);
  const [activityDiscovery, setActivityDiscovery] = useState<Extract<ClassifyTeacherBatchActivityResult, { ok: true }> | null>(null);
  const [matchResult, setMatchResult] = useState<Extract<MatchTeacherBatchResult, { ok: true }> | null>(null);
  const [hasMatchedRange, setHasMatchedRange] = useState(initialRanges.some((range) => Boolean(range.submissionId)));
  const [selectedStudents, setSelectedStudents] = useState<Record<string, string>>({});

  const selectedAssignment = availableAssignments.find((assignment) => assignment.id === assignmentId);

  async function discoverActivity() {
    if (!classId) {
      setMessage("학생 명단이 있는 학급을 먼저 선택해 주세요.");
      return;
    }
    setClassifyingActivity(true);
    setMessage("PDF의 인쇄된 활동과 문항을 읽고 가장 관련성 높은 성취기준을 찾고 있어요.");
    let result: ClassifyTeacherBatchActivityResult;
    try {
      result = await classifyTeacherBatchActivity({ sourceArtifactId: artifactId, classId });
    } catch {
      result = { ok: false, message: "활동 찾기 요청이 중단됐어요. 잠시 후 다시 시도해 주세요." };
    }
    setClassifyingActivity(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    const pageRanges = groupBatchPagesByStudent(pageCount, 1);
    setRanges(pageRanges);
    setActivityDiscovery(result);
    setMessage(`${result.message} 학생 표기는 각 페이지에서 따로 확인합니다.`);
  }

  async function confirmActivity(existingActivityId: string | null) {
    if (!activityDiscovery || !classId) return;
    setConfirmingActivity(true);
    let result;
    try {
      result = await confirmTeacherBatchActivity({
        sourceArtifactId: artifactId,
        classId,
        existingActivityId,
        draft: activityDiscovery.draft,
      });
    } catch {
      result = { ok: false as const, message: "활동 연결 요청이 중단됐어요. 잠시 후 다시 시도해 주세요." };
    }
    setConfirmingActivity(false);
    setMessage(result.message);
    if (!result.ok) return;

    const selectedClass = classes.find((classItem) => classItem.id === classId);
    const option: BatchMatchAssignmentOption = {
      id: result.assignmentId,
      classId,
      label: `${result.title} · ${selectedClass?.label ?? "선택 학급"}`,
      students: selectedClass?.students ?? [],
    };
    setAvailableAssignments((current) => [option, ...current.filter((assignment) => assignment.id !== option.id)]);
    setAssignmentId(option.id);
    await matchBatch(option.id);
  }

  async function matchBatch(targetAssignmentId = assignmentId) {
    if (!targetAssignmentId) {
      setMessage("연결할 활동과 학급을 먼저 선택해 주세요.");
      return;
    }
    setMatching(true);
    if (ranges.some((range) => !range.id)) {
      setMessage("각 페이지를 학생별 자료로 자동 정리하고 있어요.");
      const saved = await replaceTeacherBatchPageRanges({
        sourceArtifactId: artifactId,
        pageCount,
        ranges: ranges.map(({ page_start, page_end }) => ({ page_start, page_end })),
      });
      if (!saved.ok) {
        setMatching(false);
        setMessage(saved.message);
        return;
      }
      setRanges(saved.ranges);
    }
    setMessage("학생 정보와 작성된 답안을 인식하고 있어요.");
    let result: MatchTeacherBatchResult;
    try {
      result = await matchTeacherBatchPdf({
        sourceArtifactId: artifactId,
        activityAssignmentId: targetAssignmentId,
      });
    } catch {
      result = { ok: false, message: "서버 연결이 끊겼어요. 다시 시도해 주세요." };
    }
    setMatching(false);
    setMessage(result.message);
    if (result.ok) {
      setMatchResult(result);
      if (result.items.some((item) => item.submissionId !== null)) setHasMatchedRange(true);
      router.refresh();
    }
  }

  async function renewSignedUrl() {
    setRenewing(true);
    const result = await createTeacherArtifactSignedUrl(artifactId);
    setRenewing(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setSignedUrl(result.url);
    setMessage("원본 열람 링크를 5분 연장했어요.");
  }

  async function confirmReview(item: Extract<MatchTeacherBatchResult, { ok: true }>["items"][number]) {
    const studentId = selectedStudents[item.rangeArtifactId];
    if (!studentId) {
      setMessage("검토할 페이지 묶음의 학생을 선택해 주세요.");
      return;
    }
    if (item.questions.length === 0) {
      setMessage("저장할 문항 응답이 없어 이 항목은 다시 인식해야 해요.");
      return;
    }

    setCorrectingRangeId(item.rangeArtifactId);
    const result = await correctTeacherBatchReview({
      sourceArtifactId: artifactId,
      rangeArtifactId: item.rangeArtifactId,
      activityAssignmentId: assignmentId,
      studentId,
      structuredInput: {
        schema_version: "1",
        questions: item.questions.map((question) => ({
          question_id: question.questionId,
          response_type: question.responseType,
          response: question.response,
        })),
      },
      responseNeedsReview: item.questions.some((question) => question.uncertain),
    });
    setCorrectingRangeId(null);
    setMessage(result.message);
    if (!result.ok) return;

    setHasMatchedRange(true);
    const remainsReviewPending = result.inputStatus === "REVIEW_PENDING";
    setMatchResult((current) => current ? {
      ...current,
      matched: current.matched + (remainsReviewPending ? 0 : 1),
      reviewPending: Math.max(0, current.reviewPending - (remainsReviewPending ? 0 : 1)),
      items: current.items.map((currentItem) => currentItem.rangeArtifactId === item.rangeArtifactId
        ? {
            ...currentItem,
            status: remainsReviewPending ? "REVIEW_PENDING" as const : "MATCHED" as const,
            studentId,
            submissionId: result.submissionId,
            message: result.message,
          }
        : currentItem),
    } : current);
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{fileName}</p>
            <p className="text-xs text-muted">현재 {selectedPage}쪽 / 전체 {pageCount}쪽</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={renewSignedUrl} disabled={renewing} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-background disabled:opacity-50">
              <RefreshCw className={renewing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> 링크 연장
            </button>
            <a href={`${signedUrl}#page=${selectedPage}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-brand-600 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50">
              새 창 <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <iframe
          key={`${signedUrl}-${selectedPage}`}
          src={`${signedUrl}#page=${selectedPage}&view=FitH`}
          title={`Batch PDF ${selectedPage}쪽 미리보기`}
          className="h-[68vh] min-h-[560px] w-full bg-background"
        />
        <div className="border-t border-border p-3">
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
              <button key={page} type="button" onClick={() => setSelectedPage(page)} className={page === selectedPage ? "h-8 min-w-8 rounded-md bg-brand-600 px-2 text-xs font-bold text-white" : "h-8 min-w-8 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground hover:border-brand-300"}>
                {page}
              </button>
            ))}
          </div>
        </div>
      </section>

      <aside className="flex self-start flex-col gap-6 xl:sticky xl:top-6">
        {message ? <p role="status" className="order-0 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground shadow-sm">{message}</p> : null}
        <section className="order-1 rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-violet-100 p-2 text-violet-700"><Sparkles className="h-5 w-5" /></div>
            <div><h2 className="text-lg font-bold text-foreground">활동 확인</h2><p className="mt-1 text-sm text-muted">PDF에서 공통 활동지와 문항을 읽고 관련 성취기준을 찾아요.</p></div>
          </div>
          <label className="mt-4 grid gap-1.5 text-sm font-bold text-foreground">
            매칭할 우리 반 명단
            <select value={classId} onChange={(event) => { setClassId(event.target.value); setActivityDiscovery(null); }} disabled={classifyingActivity || confirmingActivity || matching || hasMatchedRange} className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground disabled:opacity-60">
              {classes.length === 0 ? <option value="">활성 학급이 없습니다</option> : null}
              {classes.map((classItem) => <option key={classItem.id} value={classItem.id}>{classItem.label}</option>)}
            </select>
            <span className="font-normal text-muted">PDF에 적힌 반·번호·이름을 선택한 학급의 학생 명단과 대조합니다.</span>
          </label>
          {hasMatchedRange ? (
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700">
              PDF 활동과 학생 연결이 이미 저장됐어요.
            </p>
          ) : (
            <button type="button" onClick={discoverActivity} disabled={classifyingActivity || confirmingActivity || matching || !classId} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">
              {classifyingActivity ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {classifyingActivity ? "활동 파악 중…" : "PDF에서 활동 찾기"}
            </button>
          )}

          {activityDiscovery ? (
            <div className="mt-4 space-y-3 rounded-xl border border-violet-200 bg-surface p-3">
              <label className="grid gap-1 text-xs font-bold text-foreground">활동 제목<input value={activityDiscovery.draft.title} onChange={(event) => setActivityDiscovery((current) => current ? { ...current, draft: { ...current.draft, title: event.target.value } } : current)} maxLength={200} className="rounded-lg border border-border px-3 py-2 text-sm" /></label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="grid gap-1 font-bold text-foreground">교과<input value={activityDiscovery.draft.subject ?? ""} onChange={(event) => setActivityDiscovery((current) => current ? { ...current, draft: { ...current.draft, subject: event.target.value || null } } : current)} maxLength={100} className="rounded-lg border border-border px-3 py-2 text-sm" /></label>
                <label className="grid gap-1 font-bold text-foreground">영역<input value={activityDiscovery.draft.domain ?? ""} onChange={(event) => setActivityDiscovery((current) => current ? { ...current, draft: { ...current.draft, domain: event.target.value || null } } : current)} maxLength={200} className="rounded-lg border border-border px-3 py-2 text-sm" /></label>
              </div>
              <p className="text-xs text-muted">{activityDiscovery.draft.grade ? `${activityDiscovery.draft.grade}학년` : "학년 미확정"} · 문항 {activityDiscovery.draft.questions.length}개</p>
              <div>
                <p className="text-xs font-bold text-foreground">가장 관련성 높은 성취기준</p>
                <div className="mt-1.5 space-y-1.5">
                  {activityDiscovery.standardOptions.length === 0 ? <p className="text-xs text-muted">문서 내용과 충분히 일치하는 성취기준을 찾지 못했어요.</p> : activityDiscovery.standardOptions.map((standard) => (
                    <label key={standard.id} className="flex items-start gap-2 rounded-lg border border-border p-2 text-xs">
                      <input type="checkbox" checked={activityDiscovery.draft.standard_candidates.includes(standard.id)} onChange={(event) => setActivityDiscovery((current) => current ? { ...current, draft: { ...current.draft, standard_candidates: event.target.checked ? [standard.id] : [] } } : current)} className="mt-0.5" />
                      <span><strong>{standard.id}</strong> · {standard.description}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => confirmActivity(null)} disabled={confirmingActivity || matching || !activityDiscovery.draft.title.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">
                {confirmingActivity ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {confirmingActivity ? "새 활동 저장 중…" : "새 활동으로 저장하고 학생 연결"}
              </button>
              {activityDiscovery.existingCandidates.length > 0 ? (
                <div className="rounded-lg border border-border bg-neutral-bg/40 p-3">
                  <div className="space-y-1.5">{activityDiscovery.existingCandidates.map((candidate) => (
                    <button key={candidate.id} type="button" onClick={() => confirmActivity(candidate.id)} disabled={confirmingActivity || matching} className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-50"><span>{candidate.title}<span className="mt-0.5 block font-normal text-muted">{candidate.reasons.join(" · ")}</span></span><span className="inline-flex shrink-0 items-center gap-1"><Link2 className="h-4 w-4" /> 기존 연결</span></button>
                  ))}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="order-2 rounded-2xl border border-brand-200 bg-brand-50/40 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-brand-100 p-2 text-brand-700"><Bot className="h-5 w-5" /></div>
            <div><h2 className="text-lg font-bold text-foreground">학생과 답안 자동 연결</h2><p className="mt-1 text-sm text-muted">활동을 확인하면 반·번호·이름과 작성 답안을 읽어 우리 반 명단의 정확히 일치하는 학생에게 자동 배정합니다.</p></div>
          </div>
          <div className="mt-4 rounded-lg border border-brand-200 bg-surface px-3 py-2.5">
            <p className="text-xs font-bold text-muted">연결할 활동</p>
            <p className="mt-1 text-sm font-bold text-foreground">{selectedAssignment?.label ?? "먼저 위에서 PDF 활동을 확인해 주세요."}</p>
          </div>
          {hasMatchedRange ? (
            <div className="mt-4 space-y-2">
              {initialReviewSubmissionIds.length > 0 ? (
                <>
                  <p className="text-sm font-bold text-warning">답안 확인이 필요한 학생 {initialReviewSubmissionIds.length}명이 있어요.</p>
                  {initialReviewSubmissionIds.map((submissionId, index) => (
                    <a key={submissionId} href={`/results/${submissionId}`} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 py-3 text-sm font-bold text-white hover:bg-amber-700">
                      <ShieldAlert className="h-4 w-4" /> 검토 대기 학생 {index + 1} 확인
                    </a>
                  ))}
                </>
              ) : (
                <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700">학생과 답안 연결이 완료됐어요.</p>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => void matchBatch()} disabled={matching || !assignmentId} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50">
              {matching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              {matching ? "반·번호·이름과 답안 인식 중…" : "학생 연결 다시 실행"}
            </button>
          )}
        </section>
      </aside>

      {matchResult ? (
        <section className="xl:col-span-2 rounded-2xl border border-border bg-surface p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-xl font-bold text-foreground">학생 연결 결과</h2>
            <div className="flex gap-2 text-xs font-bold"><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">연결 {matchResult.matched}</span><span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">검토 {matchResult.reviewPending}</span><span className="rounded-full bg-red-50 px-3 py-1.5 text-red-700">실패 {matchResult.failed}</span></div>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {matchResult.items.map((item) => {
              const Icon = item.status === "MATCHED" ? CheckCircle2 : item.status === "REVIEW_PENDING" ? ShieldAlert : XCircle;
              const tone = item.status === "MATCHED" ? "text-emerald-700 bg-emerald-50" : item.status === "REVIEW_PENDING" ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
              return (
                <article key={item.rangeArtifactId} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-foreground">{item.pageStart}~{item.pageEnd}쪽</p><p className="mt-1 text-xs text-muted">{item.grade ?? "학년 미인식"} · {item.className ?? "반 미인식"}</p></div><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}><Icon className="h-3.5 w-3.5" />{item.status === "MATCHED" ? "연결" : item.status === "REVIEW_PENDING" ? "검토" : "실패"}</span></div>
                  <p className="mt-3 text-sm font-bold text-foreground">{item.studentNumber ? `${item.studentNumber}번` : "번호 미인식"} · {item.studentName ?? "이름 미인식"}</p>
                  <p className="mt-1 text-xs text-muted">{item.message}</p>
                  {item.status === "REVIEW_PENDING" && item.submissionId === null ? (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <label className="grid gap-1.5 text-xs font-bold text-foreground">
                        교사가 학생 직접 선택
                        <select
                          value={selectedStudents[item.rangeArtifactId] ?? ""}
                          onChange={(event) => setSelectedStudents((current) => ({ ...current, [item.rangeArtifactId]: event.target.value }))}
                          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground"
                        >
                          <option value="">학생 선택</option>
                          {(selectedAssignment?.students ?? []).map((student) => (
                            <option key={student.id} value={student.id}>{student.studentNumber}번 {student.studentName}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => confirmReview(item)}
                        disabled={correctingRangeId === item.rangeArtifactId || !(selectedStudents[item.rangeArtifactId]) || item.questions.length === 0}
                        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {correctingRangeId === item.rangeArtifactId ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        {correctingRangeId === item.rangeArtifactId ? "확정 중…" : "이 학생으로 묶음 확정"}
                      </button>
                    </div>
                  ) : null}
                  <div className="mt-3 space-y-2">
                    {item.questions.map((question) => (
                      <div key={question.questionId} className="rounded-lg border border-border bg-surface p-3 text-xs">
                        <p className="font-bold text-foreground">{question.questionId} · {question.visiblePrompt ?? "문항 문구 미인식"}</p>
                        <p className="mt-1 break-words text-muted">{question.responseType}: {JSON.stringify(question.response)}</p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
