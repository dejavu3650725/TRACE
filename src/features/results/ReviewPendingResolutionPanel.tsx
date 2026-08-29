"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, Plus, RotateCcw, Trash2 } from "lucide-react";
import { OBSERVABLE_RESPONSE_TYPES, type StructuredInputRuntime } from "@/features/submissions/structured-input-schema";
import { resolveSubmissionInputReview } from "./review-actions";

type StudentOption = { id: string; label: string };
type AssignmentOption = { id: string; label: string };
type EditableQuestion = {
  key: string;
  questionId: string;
  responseType: (typeof OBSERVABLE_RESPONSE_TYPES)[number];
  responseText: string;
};
type ObservableEditResponse = Record<string, string | string[] | boolean | null>;

function responseText(response: Record<string, unknown>): string {
  if (typeof response.raw_text === "string") return response.raw_text;
  if (Array.isArray(response.selected_options)) return response.selected_options.filter((value): value is string => typeof value === "string").join("\n");
  if (Array.isArray(response.marks)) return response.marks.filter((value): value is string => typeof value === "string").join("\n");
  if (typeof response.drawing_description === "string") return response.drawing_description;
  if (response.is_blank === true) return "";
  return JSON.stringify(response, null, 2);
}

function observableResponse(type: EditableQuestion["responseType"], text: string): ObservableEditResponse {
  const trimmed = text.trim();
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (type === "blank") return { is_blank: true };
  if (type === "selection" || type === "checkbox") {
    return { selected_options: lines, is_blank: lines.length === 0 };
  }
  if (type === "matching") {
    return { pairs: lines, is_blank: lines.length === 0 };
  }
  if (type === "underline" || type === "circle") {
    return { marks: lines, is_blank: lines.length === 0 };
  }
  if (type === "drawing_or_mark") {
    return { drawing_description: trimmed || null, is_blank: !trimmed };
  }
  return { raw_text: trimmed || null, is_blank: !trimmed };
}

function textareaLabel(type: EditableQuestion["responseType"]): string {
  if (type === "selection" || type === "checkbox") return "선택한 보기 (여러 개면 줄바꿈)";
  if (type === "matching") return "연결한 짝 (한 쌍씩 줄바꿈)";
  if (type === "underline" || type === "circle") return "표시한 내용 (여러 개면 줄바꿈)";
  if (type === "drawing_or_mark") return "그림·표시 설명";
  if (type === "blank") return "빈 응답으로 확정";
  return "학생이 작성한 응답";
}

export function ReviewPendingResolutionPanel({
  submissionId,
  currentStudentId,
  currentAssignmentId,
  students,
  assignments,
  initialStructuredInput,
}: {
  submissionId: string;
  currentStudentId: string;
  currentAssignmentId: string;
  students: StudentOption[];
  assignments: AssignmentOption[];
  initialStructuredInput: StructuredInputRuntime | null;
}) {
  const router = useRouter();
  const [studentId, setStudentId] = useState(currentStudentId);
  const [assignmentId, setAssignmentId] = useState(currentAssignmentId);
  const [questions, setQuestions] = useState<EditableQuestion[]>(() => (
    initialStructuredInput?.questions.map((question, index) => ({
      key: `initial-${index}`,
      questionId: question.question_id,
      responseType: question.response_type,
      responseText: responseText(question.response),
    })) ?? [{ key: "initial-0", questionId: "Q1", responseType: "unknown", responseText: "" }]
  ));
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const updateQuestion = (index: number, patch: Partial<EditableQuestion>) => {
    setQuestions((current) => current.map((question, questionIndex) => (
      questionIndex === index ? { ...question, ...patch } : question
    )));
  };

  const save = () => {
    setMessage("");
    startTransition(() => {
      void (async () => {
        const result = await resolveSubmissionInputReview({
          submissionId,
          studentId,
          activityAssignmentId: assignmentId,
          structuredInput: {
            schema_version: "1",
            questions: questions.map((question) => ({
              question_id: question.questionId.trim(),
              response_type: question.responseType,
              response: observableResponse(question.responseType, question.responseText),
            })),
          },
        });
        setMessage(result.message);
        if (result.ok) router.refresh();
      })();
    });
  };

  return (
    <section className="rounded-2xl border border-warning/30 bg-warning-bg/40 p-5 shadow-sm md:p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-white p-2 text-warning"><RotateCcw className="h-5 w-5" /></span>
        <div>
          <h2 className="text-lg font-bold text-foreground">검토가 필요한 항목만 확인</h2>
          <p className="mt-1 text-sm text-muted">학생·활동·인식 응답을 확인하면 원본 보존 여부를 다시 검사한 뒤 분석 준비로 전환합니다.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold text-foreground">
          연결 학생
          <select value={studentId} onChange={(event) => setStudentId(event.target.value)} className="rounded-xl border border-border bg-surface px-3 py-2.5 font-medium">
            {students.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-foreground">
          연결 활동
          <select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)} className="rounded-xl border border-border bg-surface px-3 py-2.5 font-medium">
            {assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.label}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-foreground">인식된 응답</h3>
          <button type="button" onClick={() => setQuestions((current) => [...current, { key: `added-${Date.now()}-${current.length}`, questionId: `Q${current.length + 1}`, responseType: "unknown", responseText: "" }])} className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"><Plus className="h-3.5 w-3.5" /> 문항 추가</button>
        </div>
        {questions.map((question, index) => (
          <article key={question.key} className="rounded-xl border border-border bg-surface p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="grid gap-1 text-xs font-bold text-muted">문항 ID<input value={question.questionId} onChange={(event) => updateQuestion(index, { questionId: event.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
              <label className="grid gap-1 text-xs font-bold text-muted">응답 유형<select value={question.responseType} onChange={(event) => updateQuestion(index, { responseType: event.target.value as EditableQuestion["responseType"] })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">{OBSERVABLE_RESPONSE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
              <button type="button" aria-label={`${question.questionId} 삭제`} disabled={questions.length === 1} onClick={() => setQuestions((current) => current.filter((_, questionIndex) => questionIndex !== index))} className="self-end rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
            </div>
            <label className="mt-3 grid gap-1 text-xs font-bold text-muted">{textareaLabel(question.responseType)}<textarea value={question.responseText} disabled={question.responseType === "blank"} onChange={(event) => updateQuestion(index, { responseText: event.target.value })} rows={question.responseType === "long_text" ? 5 : 3} className="resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground disabled:bg-neutral-bg" /></label>
          </article>
        ))}
      </div>

      {message ? <p role="status" className="mt-4 rounded-lg bg-surface px-3 py-2 text-sm font-bold text-foreground">{message}</p> : null}
      <button type="button" onClick={save} disabled={pending || !studentId || !assignmentId || questions.length === 0} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50">
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {pending ? "검토 결과 저장 중…" : "확인하고 분석 준비로 전환"}
      </button>
    </section>
  );
}
