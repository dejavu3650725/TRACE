"use client";

import { useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

/**
 * ISSUE-22 — 결과 스프레드시트 Import 흐름 (선택 → 템플릿 → 업로드 → Preview → 확정)
 * 유효/오류 행을 분리해 보여주고, 교사가 확인한 뒤에만 실제 DB에 저장한다.
 */

export interface AssignmentOption {
  id: string;
  label: string;
}

interface PreviewRow {
  rowNo: number;
  studentNumber: number | null;
  studentName: string;
  answers: Record<string, string>;
  error: string | null;
}

export function ResultImportPanel({ assignments }: { assignments: AssignmentOption[] }) {
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.id ?? "");
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [valid, setValid] = useState<PreviewRow[]>([]);
  const [invalid, setInvalid] = useState<PreviewRow[]>([]);
  const [done, setDone] = useState<{ saved: number; failed: number } | null>(null);

  const reset = () => {
    setQuestionIds([]);
    setValid([]);
    setInvalid([]);
    setDone(null);
    setError(null);
  };

  const onFile = async (file: File | null) => {
    if (!file || !assignmentId) return;
    reset();
    setParsing(true);
    const fd = new FormData();
    fd.set("assignmentId", assignmentId);
    fd.set("file", file);
    try {
      const res = await fetch("/api/results-import/parse", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "파일을 읽지 못했어요.");
      setQuestionIds(json.question_ids ?? []);
      setValid(json.valid ?? []);
      setInvalid(json.invalid ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "파일을 읽지 못했어요.");
    } finally {
      setParsing(false);
    }
  };

  const onCommit = async () => {
    if (valid.length === 0) return;
    setCommitting(true);
    setError(null);
    try {
      const res = await fetch("/api/results-import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_id: assignmentId,
          rows: valid.map((r) => ({
            student_number: r.studentNumber,
            student_name: r.studentName,
            answers: r.answers,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "저장에 실패했어요.");
      setDone({ saved: json.saved, failed: (json.failures ?? []).length });
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요.");
    } finally {
      setCommitting(false);
    }
  };

  if (assignments.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
        먼저 활동을 학급에 배정해 주세요. 결과 가져오기는 배정 단위로 진행돼요.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. 배정 선택 + 템플릿 */}
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className="text-sm font-bold text-foreground">01 · 활동 배정 선택</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value={assignmentId}
            onChange={(e) => {
              setAssignmentId(e.target.value);
              reset();
            }}
            className="min-w-64 flex-1 rounded-xl border border-line bg-background px-3 py-2.5 text-sm"
          >
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <a
            href={`/api/results-template?assignmentId=${assignmentId}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 px-4 py-2.5 text-sm font-bold text-brand-700 hover:bg-brand-50"
          >
            <Download className="h-4 w-4" /> 표준 템플릿 받기
          </a>
        </div>
        <p className="mt-2 text-xs text-muted">
          템플릿에는 학급 명렬이 미리 채워져 있어요. 문항 열에 응답만 입력하세요. (CSV/XLSX, 10MB 이하)
        </p>
      </div>

      {/* 2. 업로드 */}
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className="text-sm font-bold text-foreground">02 · 작성한 파일 업로드</p>
        <label className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-background px-6 py-8 text-muted transition-colors hover:border-brand-300 hover:text-brand-700">
          {parsing ? <Loader2 className="h-7 w-7 animate-spin" /> : <Upload className="h-7 w-7" />}
          <span className="text-sm font-semibold">{parsing ? "검증 중…" : "CSV/XLSX 선택 또는 끌어다 놓기"}</span>
          <input
            type="file"
            accept=".csv,.xlsx"
            hidden
            onChange={(e) => {
              void onFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {error && (
        <p className="rounded-2xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">{error}</p>
      )}

      {/* 3. Preview */}
      {(valid.length > 0 || invalid.length > 0) && !done && (
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-bold text-foreground">
              <FileSpreadsheet className="h-4 w-4 text-brand-600" /> 03 · 가져오기 미리보기
            </p>
            <span className="flex gap-2">
              <StatusBadge label={`유효 ${valid.length}행`} tone="success" />
              {invalid.length > 0 && <StatusBadge label={`오류 ${invalid.length}행`} tone="danger" />}
            </span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="py-2 pr-3">행</th>
                  <th className="py-2 pr-3">번호</th>
                  <th className="py-2 pr-3">이름</th>
                  {questionIds.map((q) => (
                    <th key={q} className="py-2 pr-3">{q}</th>
                  ))}
                  <th className="py-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {[...valid, ...invalid]
                  .sort((a, b) => a.rowNo - b.rowNo)
                  .map((row) => (
                    <tr key={row.rowNo} className={`border-b border-line/60 ${row.error ? "bg-danger-bg/40" : ""}`}>
                      <td className="py-2 pr-3 tabular-nums text-muted">{row.rowNo}</td>
                      <td className="py-2 pr-3 tabular-nums">{row.studentNumber ?? "—"}</td>
                      <td className="py-2 pr-3 font-semibold">{row.studentName || "—"}</td>
                      {questionIds.map((q) => (
                        <td key={q} className="max-w-48 truncate py-2 pr-3 text-muted">{row.answers[q] || "—"}</td>
                      ))}
                      <td className="py-2">
                        {row.error ? (
                          <span className="text-xs font-semibold text-danger">{row.error}</span>
                        ) : (
                          <span className="text-xs font-semibold text-success">가져오기 가능</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted">오류 행은 저장되지 않아요. 파일을 고쳐 다시 업로드할 수 있어요.</p>
            <button
              type="button"
              disabled={committing || valid.length === 0}
              onClick={() => void onCommit()}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              유효 {valid.length}행 가져오기 확정
            </button>
          </div>
        </div>
      )}

      {done && (
        <div className="flex items-center gap-3 rounded-2xl border border-success/20 bg-success-bg px-5 py-4">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
          <p className="text-sm font-semibold text-success">
            {done.saved}명의 결과를 저장했어요{done.failed > 0 ? ` (실패 ${done.failed}건)` : ""}. 평가관리에서 바로
            분석을 실행할 수 있어요.
          </p>
        </div>
      )}
    </div>
  );
}
