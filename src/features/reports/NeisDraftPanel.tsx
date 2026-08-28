"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Clipboard,
  FileDown,
  RotateCcw,
} from "lucide-react";
import {
  calculateNeisBytes,
  findNeisReviewWarnings,
  isMeaningfullyEdited,
} from "@/lib/output/neis-draft";
import styles from "./report-experience.module.css";

interface EvidenceReference {
  id: string;
  label: string;
  claim: string;
  href: string | null;
}

interface NeisDraftPanelProps {
  initialDraft: string;
  sourceLabel: string;
  recordArea: string;
  evidence: EvidenceReference[];
}

type CopyState = "idle" | "success" | "error";

export function NeisDraftPanel({
  initialDraft,
  sourceLabel,
  recordArea,
  evidence,
}: NeisDraftPanelProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [teacherConfirmed, setTeacherConfirmed] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const byteCount = useMemo(() => calculateNeisBytes(draft), [draft]);
  const warnings = useMemo(() => findNeisReviewWarnings(draft), [draft]);
  const isEdited = isMeaningfullyEdited(initialDraft, draft);
  const isReady = isEdited && teacherConfirmed && draft.trim().length > 0;

  async function copyDraft() {
    if (!isReady) return;

    try {
      await navigator.clipboard.writeText(draft.trim());
      setCopyState("success");
      window.setTimeout(() => setCopyState("idle"), 3000);
    } catch {
      setCopyState("error");
    }
  }

  function resetDraft() {
    setDraft(initialDraft);
    setTeacherConfirmed(false);
    setCopyState("idle");
  }

  return (
    <section
      className={`${styles.draftPanel} rounded-3xl border border-warning/25 p-5 shadow-[var(--shadow-card)] sm:p-6`}
      aria-labelledby="neis-draft-heading"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.14em] text-warning">TEACHER DRAFT</p>
              <h3 id="neis-draft-heading" className="mt-2 text-xl font-bold text-foreground">
                나이스 생기부 기록 제안
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted">{recordArea}</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-warning-bg px-3 py-1.5 text-xs font-bold text-warning">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              교사 수정 전 초안
            </span>
          </div>

          <label htmlFor="neis-draft" className="mt-6 block text-sm font-bold text-foreground">
            승인 Evidence를 참고한 제안문
          </label>
          <textarea
            id="neis-draft"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setTeacherConfirmed(false);
              setCopyState("idle");
            }}
            rows={8}
            className="no-print mt-2 w-full resize-y rounded-2xl border border-line bg-surface px-4 py-4 text-base leading-7 text-foreground outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
            aria-describedby="neis-draft-help neis-byte-count neis-review-status"
          />

          <div className="print-only mt-5 rounded-2xl border border-line bg-surface p-5 text-base leading-7 text-foreground">
            <p className="mb-2 text-xs font-bold text-muted">교사 검토 문안</p>
            <p>{draft.trim()}</p>
          </div>

          <div className="no-print mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p id="neis-draft-help" className="max-w-2xl leading-6 text-muted">
              AI가 만든 문장을 그대로 입력하지 말고, 아래 근거와 원본을 대조해 교사의 문장으로 수정하세요.
            </p>
            <p id="neis-byte-count" className="tabular-nums font-semibold text-foreground">
              {byteCount.toLocaleString("ko-KR")} Byte
            </p>
          </div>

          {warnings.length > 0 && (
            <ul className="no-print mt-4 space-y-2 rounded-2xl border border-warning/30 bg-warning-bg p-4 text-sm leading-6 text-warning">
              {warnings.map((warning) => (
                <li key={warning} className="flex gap-2">
                  <AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                  {warning}
                </li>
              ))}
            </ul>
          )}

          <label className="no-print mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-background p-4 text-sm leading-6 text-foreground transition-colors hover:border-brand-300 hover:bg-brand-50/50">
            <input
              type="checkbox"
              checked={teacherConfirmed}
              disabled={!isEdited}
              onChange={(event) => setTeacherConfirmed(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-line text-brand-600 accent-brand-600 focus:ring-brand-300 disabled:cursor-not-allowed"
            />
            <span>
              <strong className="block font-bold">근거 대조와 교사 수정을 완료했습니다.</strong>
              <span className="text-muted">
                제안문을 한 번 이상 의미 있게 수정해야 확인할 수 있습니다.
              </span>
            </span>
          </label>

          <div className="no-print mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={copyDraft}
              disabled={!isReady}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-[background-color,transform,box-shadow] duration-200 hover:bg-brand-700 hover:shadow-[var(--shadow-card)] active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-brand-200 disabled:cursor-not-allowed disabled:bg-neutral disabled:opacity-45 motion-reduce:transform-none"
            >
              <span
                className={styles.actionSwapLabel}
                data-state={copyState === "success" ? "success" : "idle"}
              >
                {copyState === "success" ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Clipboard className="h-4 w-4" aria-hidden="true" />
                )}
                {copyState === "success" ? "복사 완료" : "교사 문안 복사"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!isReady}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-bold text-foreground transition-[border-color,background-color,transform] duration-200 hover:border-brand-300 hover:bg-brand-50 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transform-none"
            >
              <FileDown className="h-4 w-4 text-brand-600" aria-hidden="true" />
              인쇄·PDF 저장
            </button>
            <button
              type="button"
              onClick={resetDraft}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-muted transition-colors duration-200 hover:bg-neutral-bg hover:text-foreground focus:outline-none focus:ring-4 focus:ring-brand-100"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              초안 되돌리기
            </button>
          </div>

          <p
            id="neis-review-status"
            className={`no-print mt-3 min-h-6 text-sm font-semibold ${
              copyState === "error" ? "text-danger" : isReady ? "text-success" : "text-muted"
            }`}
            aria-live="polite"
          >
            {copyState === "error"
              ? "클립보드에 복사하지 못했습니다. 브라우저 권한을 확인하세요."
              : isReady
                ? "교사 검토가 확인되었습니다. 복사하거나 PDF로 저장할 수 있습니다."
                : "문안을 수정하고 교사 확인을 완료하면 출력 기능이 활성화됩니다."}
          </p>
        </div>

        <aside className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4 sm:p-5" aria-label="제안문 근거">
          <div className="flex items-center gap-2 text-sm font-bold text-brand-800">
            <BadgeCheck className="h-4 w-4" aria-hidden="true" />
            문장에 연결된 승인 근거
          </div>
          <ol className="mt-4 space-y-3">
            {evidence.map((item, index) => (
              <li key={item.id} className="rounded-xl border border-brand-200/80 bg-surface p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-brand-700">
                    {String(index + 1).padStart(2, "0")} · {item.label}
                  </p>
                  {item.href ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="no-print text-xs font-bold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-300"
                    >
                      원본 보기
                    </a>
                  ) : (
                    <span className="no-print text-xs font-bold text-muted">보호 원본</span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-foreground">{item.claim}</p>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-xl bg-surface/80 p-3 text-xs leading-5 text-muted">
            <p className="font-bold text-foreground">기재 기준</p>
            <p className="mt-1">{sourceLabel}</p>
            <p className="mt-2">공식 원문과 학교 기준을 최종 확인하는 책임은 교사에게 있습니다.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
