"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import Image from "next/image";
import { Columns2, ExternalLink, FileText, Pencil, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AnalysisResult } from "@/features/process/schema";
import type { StructuredInput } from "@/shared/types/db";
import { submitReview, type ReviewActionState } from "@/app/(teacher)/analysis/[analysisId]/review/actions";

const initialState: ReviewActionState = { error: null };

export type ReviewOriginalFile = {
  artifactId: string;
  originalArtifactId: string;
  fileName: string;
  mimeType: string;
  pageStart: number | null;
  pageEnd: number | null;
  signedUrl: string;
};

function filePageLabel(file: ReviewOriginalFile): string {
  if (file.pageStart === null) return "전체 원본";
  if (file.pageEnd === null || file.pageStart === file.pageEnd) return `${file.pageStart}쪽`;
  return `${file.pageStart}~${file.pageEnd}쪽`;
}

function OriginalFilePreview({ file }: { file: ReviewOriginalFile }) {
  const pageUrl = file.mimeType === "application/pdf" && file.pageStart
    ? `${file.signedUrl}#page=${file.pageStart}&view=FitH`
    : file.signedUrl;

  if (file.mimeType === "application/pdf") {
    return (
      <iframe
        src={pageUrl}
        title={`${file.fileName} ${filePageLabel(file)} 원본`}
        className="h-[70vh] min-h-[620px] w-full bg-white"
      />
    );
  }
  if (file.mimeType.startsWith("image/")) {
    return (
      <Image
        src={file.signedUrl}
        alt={`${file.fileName} 원본`}
        width={1000}
        height={1400}
        unoptimized
        className="h-auto w-full"
      />
    );
  }
  return (
    <div className="flex min-h-72 items-center justify-center p-6">
      <a href={file.signedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700">
        <ExternalLink className="h-4 w-4" /> 원본 파일 열기
      </a>
    </div>
  );
}

/**
 * 검토 화면 본체 (TRD §45)
 * 좌: 원본 Artifact / 우: [성취수준] + 4카드(강점·어려운 점·근거·피드백 초안)
 * Actions 순서 고정: [수정] [반려] [승인]
 * 하단 고정 주석: "학생 이름과 번호는 AI로 전송되지 않습니다."
 */
export function ReviewPanel({
  analysisId,
  readOnly,
  initial,
  levelOptions,
  standards,
  originalFiles,
  structuredInput,
}: {
  analysisId: string;
  readOnly: boolean;
  initial: AnalysisResult;
  levelOptions: string[];
  standards: Array<{ id: string; text: string }>;
  originalFiles: ReviewOriginalFile[];
  structuredInput: StructuredInput | null;
}) {
  const [editing, setEditing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [level, setLevel] = useState(initial.achievement_level);
  const [strengths, setStrengths] = useState(initial.strengths.join("\n"));
  const [difficulties, setDifficulties] = useState(
    initial.difficulties.map((d) => (d.is_repeated_error ? `[반복] ${d.text}` : d.text)).join("\n"),
  );
  const [feedback, setFeedback] = useState(initial.feedback_candidate);
  const [state, formAction, pending] = useActionState(submitReview, initialState);
  const approveRef = useRef<HTMLButtonElement>(null);
  const rejectRef = useRef<HTMLButtonElement>(null);

  // 키보드 단축키 — A 승인 / R 반려 / E 수정 토글 (입력 필드 포커스 중엔 무시)
  useEffect(() => {
    if (readOnly) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "a") {
        event.preventDefault();
        approveRef.current?.click();
      } else if (key === "r") {
        event.preventDefault();
        rejectRef.current?.click();
      } else if (key === "e") {
        event.preventDefault();
        setEditing((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readOnly]);

  const edited: AnalysisResult = useMemo(
    () => ({
      achievement_level: level,
      strengths: strengths.split("\n").map((s) => s.trim()).filter(Boolean),
      difficulties: difficulties
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((text) =>
          text.startsWith("[반복]")
            ? { text: text.replace(/^\[반복\]\s*/, ""), is_repeated_error: true }
            : { text, is_repeated_error: false },
        ),
      evidence: initial.evidence,
      feedback_candidate: feedback.trim(),
    }),
    [level, strengths, difficulties, feedback, initial.evidence],
  );

  const isChanged = useMemo(
    () => JSON.stringify(edited) !== JSON.stringify(initial),
    [edited, initial],
  );

  const fieldClass =
    "w-full rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none transition-colors duration-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:border-transparent disabled:bg-transparent disabled:px-0 disabled:resize-none";

  return (
    <div className="space-y-6">
      {originalFiles.length > 0 ? (
        <button type="button" onClick={() => setComparing((current) => !current)} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700">
          {comparing ? <X className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
          {comparing ? "대조 화면 닫기" : "원본과 대조하기"}
        </button>
      ) : null}

      {comparing && originalFiles.length > 0 ? (
        <section className="grid overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card-hover)] lg:grid-cols-2">
          <div className="min-w-0 border-b border-line lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div>
                <h2 className="font-bold text-foreground">원본파일</h2>
                <p className="text-xs text-muted">{filePageLabel(originalFiles[0])}</p>
              </div>
              <a href={originalFiles[0].signedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:underline">
                새 창 <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="max-h-[78vh] overflow-auto">
              {originalFiles.map((file) => <OriginalFilePreview key={file.artifactId} file={file} />)}
            </div>
          </div>

          <div className="min-w-0 bg-background/60">
            <div className="border-b border-line px-4 py-3">
              <h2 className="font-bold text-foreground">Evidence와 판정 근거</h2>
              <p className="text-xs text-muted">원본의 학생 표시와 AI 근거 문장을 한눈에 대조합니다.</p>
            </div>
            <div className="max-h-[78vh] space-y-4 overflow-auto p-4">
              {initial.evidence.map((evidence, index) => (
                <article key={`${evidence.question_id ?? "evidence"}-${index}`} className="rounded-xl border border-brand-200 bg-surface p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-brand-700">Evidence {index + 1}</span>
                    <span className="text-xs text-muted">{evidence.question_id ?? "문항 미지정"}{evidence.source_page ? ` · 원본 ${evidence.source_page}쪽` : ""}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-foreground">{evidence.claim}</p>
                </article>
              ))}
              <article className="rounded-xl border border-line bg-surface p-4">
                <p className="text-xs font-bold text-muted">성취수준</p>
                <p className="mt-2 text-lg font-extrabold text-foreground">{level}</p>
              </article>
              <article className="rounded-xl border border-line bg-surface p-4">
                <p className="text-xs font-bold text-muted">강점</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{strengths}</p>
              </article>
              <article className="rounded-xl border border-line bg-surface p-4">
                <p className="text-xs font-bold text-muted">어려운 점</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{difficulties}</p>
              </article>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* 좌: 원본 */}
      <section className="space-y-3">
        {structuredInput && (
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
            <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <FileText className="h-4 w-4 text-brand-600" /> 관찰된 학생 응답
            </p>
            <ul className="mt-3 space-y-2">
              {structuredInput.questions?.map((q) => (
                <li key={q.question_id} className="rounded-xl bg-neutral-bg/60 px-3 py-2 text-sm">
                  <span className="font-semibold text-brand-700">{q.question_id}</span>{" "}
                  <span className="text-foreground">
                    {typeof q.response === "object" ? JSON.stringify(q.response) : String(q.response)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {standards.length > 0 && (
          <div className="rounded-2xl border border-line bg-surface p-5 text-sm shadow-[var(--shadow-card)]">
            <p className="font-bold text-foreground">성취기준</p>
            {standards.map((s) => (
              <p key={s.id} className="mt-1.5 text-muted">
                <span className="font-semibold text-brand-700">[{s.id}]</span> {s.text}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* 우: AI 분석 4카드 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-muted">AI 분석 초안</h2>
          {editing && <StatusBadge label="수정 중" tone="warning" />}
        </div>

        {/* 성취수준 */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <p className="text-sm font-bold text-foreground">성취수준</p>
          <div className="mt-3 flex gap-2">
            {levelOptions.map((option) => (
              <button
                key={option}
                type="button"
                disabled={!editing}
                onClick={() => setLevel(option)}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors duration-200 ${
                  level === option
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-line text-muted"
                } ${editing ? "hover:border-brand-300" : "cursor-default"}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* ① 강점 */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <p className="text-sm font-bold text-foreground">① 강점</p>
          <textarea
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            disabled={!editing}
            rows={3}
            className={`mt-2 ${fieldClass}`}
            placeholder="한 줄에 하나씩"
          />
        </div>

        {/* ② 어려운 점 (반복 오류는 [반복] 접두어 태그) */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <p className="text-sm font-bold text-foreground">
            ② 어려운 점 <span className="text-xs font-medium text-muted">([반복] 으로 시작하면 반복 오류 태그)</span>
          </p>
          <textarea
            value={difficulties}
            onChange={(e) => setDifficulties(e.target.value)}
            disabled={!editing}
            rows={3}
            className={`mt-2 ${fieldClass}`}
            placeholder="한 줄에 하나씩"
          />
        </div>

        {/* ③ 근거 */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <p className="text-sm font-bold text-foreground">③ 근거</p>
          <ul className="mt-2 space-y-2">
            {initial.evidence.map((e, i) => (
              <li key={i} className="rounded-xl bg-brand-50/60 px-3 py-2 text-sm text-foreground">
                &ldquo;{e.claim}&rdquo;
                <span className="ml-2 text-xs text-muted">
                  {e.question_id ? `${e.question_id}` : ""}
                  {e.source_page ? ` · ${e.source_page}p` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ④ 피드백 초안 */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <p className="text-sm font-bold text-foreground">④ 피드백 초안</p>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            disabled={!editing}
            rows={4}
            className={`mt-2 ${fieldClass}`}
          />
        </div>

        {/* TeacherReviewBar — [수정] [반려] [승인] 순서 고정 */}
        {!readOnly && (
          <form
            action={formAction}
            className="sticky bottom-4 flex items-center gap-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-[var(--shadow-card-hover)] backdrop-blur"
          >
            <input type="hidden" name="analysis_id" value={analysisId} />
            <input
              type="hidden"
              name="decision"
              value={isChanged ? "EDITED_APPROVED" : "APPROVED"}
            />
            <input type="hidden" name="edited_json" value={JSON.stringify(edited)} />

            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-neutral-bg"
            >
              <Pencil className="h-4 w-4" />
              {editing ? "수정 완료" : "수정"}
              <kbd className="rounded-md border border-line bg-neutral-bg px-1.5 font-sans text-[11px] font-semibold text-muted">
                E
              </kbd>
            </button>

            <button
              ref={rejectRef}
              type="submit"
              formAction={(fd) => {
                fd.set("decision", "REJECTED");
                return formAction(fd);
              }}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-danger/30 px-4 py-2.5 text-sm font-semibold text-danger transition-colors duration-200 hover:bg-danger-bg disabled:opacity-50"
            >
              <ThumbsDown className="h-4 w-4" />
              반려
              <kbd className="rounded-md border border-danger/20 bg-danger-bg px-1.5 font-sans text-[11px] font-semibold text-danger/70">
                R
              </kbd>
            </button>

            <button
              ref={approveRef}
              type="submit"
              disabled={pending}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-brand-700 disabled:opacity-50"
            >
              <ThumbsUp className="h-4 w-4" />
              {pending ? "저장 중..." : isChanged ? "수정 후 승인" : "승인"}
              <kbd className="rounded-md border border-white/30 bg-white/15 px-1.5 font-sans text-[11px] font-semibold text-white/90">
                A
              </kbd>
            </button>
          </form>
        )}

        {state.error && <p className="text-sm text-danger">{state.error}</p>}

        <p className="text-center text-xs text-muted">
          학생 이름과 번호는 AI로 전송되지 않습니다.
        </p>
      </section>
      </div>
    </div>
  );
}
