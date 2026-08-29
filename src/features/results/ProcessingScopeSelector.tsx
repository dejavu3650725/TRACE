"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ListFilter, LoaderCircle, Sparkles, UserRound, UsersRound } from "lucide-react";
import {
  resolveProcessingScope,
  type ProcessingScopeMode,
  type ProcessingScopeRow,
} from "./processing-scope";

const MODE_OPTIONS: Array<{
  value: ProcessingScopeMode;
  label: string;
  description: string;
}> = [
  { value: "activity", label: "활동 전체", description: "한 활동에 제출된 결과" },
  { value: "student", label: "학생 1명", description: "한 학생의 누적 활동" },
  { value: "students", label: "학생 여러 명", description: "선택한 학생들의 활동" },
  { value: "filtered", label: "현재 조회 결과", description: "적용한 필터에 맞는 결과" },
];

export function ProcessingScopeSelector({ rows }: { rows: ProcessingScopeRow[] }) {
  const router = useRouter();
  const activities = useMemo(() => [...new Map(rows.map((row) => [row.assignmentId, {
    id: row.assignmentId,
    label: row.activityLabel,
  }])).values()], [rows]);
  const students = useMemo(() => [...new Map(rows.map((row) => [row.studentId, {
    id: row.studentId,
    label: row.studentLabel,
  }])).values()], [rows]);

  const [mode, setMode] = useState<ProcessingScopeMode>("filtered");
  const [assignmentId, setAssignmentId] = useState(activities[0]?.id ?? "");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [confirmedScope, setConfirmedScope] = useState<{
    signature: string;
    submissionIds: string[];
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveAssignmentId = activities.some((activity) => activity.id === assignmentId)
    ? assignmentId
    : (activities[0]?.id ?? "");
  const effectiveStudentId = students.some((student) => student.id === studentId)
    ? studentId
    : (students[0]?.id ?? "");

  const resolved = useMemo(() => resolveProcessingScope(rows, {
    mode,
    assignmentId: effectiveAssignmentId,
    studentId: effectiveStudentId,
    studentIds,
  }), [effectiveAssignmentId, effectiveStudentId, mode, rows, studentIds]);
  const signature = `${mode}:${resolved.submissionIds.join(",")}`;
  const confirmed = confirmedScope?.signature === signature;

  const chooseMode = (nextMode: ProcessingScopeMode) => {
    setMode(nextMode);
    setConfirmedScope(null);
  };

  const startAnalysis = async () => {
    if (!confirmed || !confirmedScope || running) return;
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/process/analysis-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_ids: confirmedScope.submissionIds }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        data: { job_id: string } | null;
        error: { message: string } | null;
      };
      if (!result.ok || !result.data) throw new Error(result.error?.message ?? "분석을 시작하지 못했어요.");
      router.push(`/analysis/jobs/${result.data.job_id}`);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "분석을 시작하지 못했어요.");
      setRunning(false);
    }
  };
  const toggleStudent = (nextStudentId: string) => {
    setStudentIds((current) => current.includes(nextStudentId)
      ? current.filter((id) => id !== nextStudentId)
      : [...current, nextStudentId]);
    setConfirmedScope(null);
  };

  return (
    <section className="rounded-2xl border border-brand-200 bg-brand-50/40 p-5 shadow-sm md:p-6" aria-labelledby="processing-scope-heading">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-white p-2 text-brand-700"><ListFilter className="h-5 w-5" /></span>
        <div>
          <h2 id="processing-scope-heading" className="text-lg font-bold text-foreground">분석할 결과 선택</h2>
          <p className="mt-1 text-sm text-muted">분석 준비가 완료된 결과만 선택됩니다.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mode === option.value}
            onClick={() => chooseMode(option.value)}
            className={`rounded-xl border px-4 py-3 text-left transition ${mode === option.value ? "border-brand-500 bg-white shadow-sm" : "border-border bg-surface hover:border-brand-300"}`}
          >
            <span className="block text-sm font-bold text-foreground">{option.label}</span>
            <span className="mt-0.5 block text-xs text-muted">{option.description}</span>
          </button>
        ))}
      </div>

      {mode === "activity" ? (
        <label className="mt-4 grid gap-1.5 text-sm font-bold text-foreground">
          활동
          <select value={effectiveAssignmentId} onChange={(event) => { setAssignmentId(event.target.value); setConfirmedScope(null); }} className="rounded-xl border border-border bg-surface px-3 py-2.5 font-medium">
            {activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.label}</option>)}
          </select>
        </label>
      ) : null}

      {mode === "student" ? (
        <label className="mt-4 grid gap-1.5 text-sm font-bold text-foreground">
          학생
          <select value={effectiveStudentId} onChange={(event) => { setStudentId(event.target.value); setConfirmedScope(null); }} className="rounded-xl border border-border bg-surface px-3 py-2.5 font-medium">
            {students.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}
          </select>
        </label>
      ) : null}

      {mode === "students" ? (
        <fieldset className="mt-4">
          <legend className="text-sm font-bold text-foreground">학생 선택</legend>
          <div className="mt-2 grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((student) => (
              <label key={student.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-brand-50">
                <input type="checkbox" checked={studentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} className="h-4 w-4 accent-brand-600" />
                <span className="font-medium text-foreground">{student.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface px-4 py-3"><p className="text-xs font-bold text-muted">전체 결과</p><p className="mt-1 text-xl font-bold text-foreground">{resolved.total}</p></div>
        <div className="rounded-xl border border-brand-200 bg-surface px-4 py-3"><p className="text-xs font-bold text-brand-700">분석 준비</p><p className="mt-1 text-xl font-bold text-brand-700">{resolved.ready}</p></div>
        <div className="rounded-xl border border-border bg-surface px-4 py-3"><p className="text-xs font-bold text-muted">선택 제외</p><p className="mt-1 text-xl font-bold text-muted">{resolved.notEligible}</p></div>
      </div>

      {confirmed && confirmedScope ? (
        <div className="mt-4 space-y-3">
          <p role="status" className="flex items-center gap-2 rounded-xl bg-success-bg px-4 py-3 text-sm font-bold text-success">
            <CheckCircle2 className="h-4 w-4" /> {confirmedScope.submissionIds.length}건을 분석 대상으로 선택했어요.
          </p>
          <button type="button" onClick={startAnalysis} disabled={running} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-bold text-background hover:opacity-90 disabled:opacity-50">
            {running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {running ? "분석 작업을 준비하는 중…" : `선택한 ${confirmedScope.submissionIds.length}건 분석 시작`}
          </button>
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-3 rounded-xl bg-danger-bg px-4 py-3 text-sm font-bold text-danger">{error}</p> : null}

      <button
        type="button"
        disabled={resolved.ready === 0}
        onClick={() => setConfirmedScope({ signature, submissionIds: [...resolved.submissionIds] })}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mode === "student" ? <UserRound className="h-4 w-4" /> : <UsersRound className="h-4 w-4" />}
        분석 대상 {resolved.ready}건 선택
      </button>
    </section>
  );
}
