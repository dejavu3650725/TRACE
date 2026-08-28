"use client";

import { useActionState, useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import {
  generateAiActivityDraft,
  saveAiActivityDraft,
  type AiActivityDraftState,
} from "./ai-actions";
import { AI_QUESTION_TYPES, AI_QUESTION_TYPE_LABEL } from "./ai-schema";
import {
  CURRICULUM_SCHOOL_LEVELS,
  type CurriculumSchoolLevel,
} from "./curriculum";

const SCHOOL_GRADES: Record<CurriculumSchoolLevel, readonly number[]> = {
  초등학교: [1, 2, 3, 4, 5, 6],
  고등학교: [10, 11, 12],
};

const initialState: AiActivityDraftState = {
  status: "idle",
  message: null,
  draft: null,
  standardOptions: [],
  provider: null,
  model: null,
  draftKey: null,
  requestedSchoolLevel: null,
  requestedGrade: null,
};

export function AiActivityDraftPanel({
  parentOptions,
}: {
  parentOptions: Array<{ id: string; title: string; status: string }>;
}) {
  const [state, generateAction, pending] = useActionState(generateAiActivityDraft, initialState);
  const [schoolLevel, setSchoolLevel] = useState<CurriculumSchoolLevel | "">("");
  const [grade, setGrade] = useState("");
  const resultMatchesSelection =
    state.requestedSchoolLevel === (schoolLevel || null) &&
    state.requestedGrade === (grade === "" ? null : Number(grade));
  const showStateMessage = state.requestedSchoolLevel === null || resultMatchesSelection;

  function changeSchoolLevel(value: string) {
    const nextSchoolLevel = CURRICULUM_SCHOOL_LEVELS.find((item) => item === value) ?? "";
    setSchoolLevel(nextSchoolLevel);
    setGrade("");
  }

  return (
    <section className="rounded-2xl border border-brand-200 bg-brand-50/40 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-brand-100 p-2 text-brand-700"><Bot className="h-5 w-5" /></span>
        <div><h2 className="font-bold text-foreground">자연어로 AI 초안 만들기</h2><p className="mt-1 text-sm text-muted">학생 이름·번호·교사 이메일은 입력하지 마세요. 서버는 좁힌 성취기준 후보만 Gemini에 전달합니다.</p></div>
      </div>

      <form action={generateAction} className="mt-5 space-y-4">
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          만들고 싶은 활동
          <textarea required name="teacherPrompt" minLength={10} maxLength={2000} rows={4} placeholder="예: 3학년 국어 읽기 영역에서 중심 문장과 뒷받침 문장을 구분하는 4문항 활동지를 만들어줘." className="rounded-lg border border-border bg-surface px-3 py-2" />
        </label>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium text-foreground">학교급<select required name="aiSchoolLevel" value={schoolLevel} onChange={(event) => changeSchoolLevel(event.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2"><option value="">학교급 선택</option>{CURRICULUM_SCHOOL_LEVELS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">학년<select required name="aiGrade" value={grade} disabled={!schoolLevel} onChange={(event) => setGrade(event.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2"><option value="">학년 선택</option>{(schoolLevel ? SCHOOL_GRADES[schoolLevel] : []).map((value) => <option key={value} value={value}>{value <= 6 ? `${value}학년` : `고${value - 9}`}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">교과 <span className="font-normal text-muted">(선택)</span><input key={schoolLevel} name="aiSubject" maxLength={100} value={schoolLevel === "고등학교" ? "정보" : undefined} readOnly={schoolLevel === "고등학교"} defaultValue={schoolLevel === "고등학교" ? undefined : ""} placeholder="예: 국어" className="rounded-lg border border-border bg-surface px-3 py-2" /></label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">영역 <span className="font-normal text-muted">(선택)</span><input name="aiDomain" maxLength={200} placeholder="예: 읽기" className="rounded-lg border border-border bg-surface px-3 py-2" /></label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">단원 <span className="font-normal text-muted">(선택)</span><input name="aiUnit" maxLength={200} className="rounded-lg border border-border bg-surface px-3 py-2" /></label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">활동 유형 <span className="font-normal text-muted">(선택)</span><input name="aiActivityType" maxLength={100} placeholder="예: 활동지" className="rounded-lg border border-border bg-surface px-3 py-2" /></label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">성취기준 핵심어 <span className="font-normal text-muted">(선택)</span><input name="standardKeyword" maxLength={100} placeholder="예: 중심 문장" className="rounded-lg border border-border bg-surface px-3 py-2" /></label>
        </div>
        <div className="flex justify-end"><button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"><Sparkles className="h-4 w-4" /> {pending ? "실제 AI가 초안을 만드는 중…" : "AI 초안 생성"}</button></div>
      </form>

      {state.message && showStateMessage && <p aria-live="polite" className={`mt-4 rounded-xl px-4 py-3 text-sm ${state.status === "error" ? "bg-danger-bg text-danger" : "bg-success-bg text-success"}`}>{state.message}</p>}

      {state.status === "success" && state.draft && resultMatchesSelection && (
        <form key={state.draftKey} action={saveAiActivityDraft} className="mt-5 rounded-2xl border border-brand-200 bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-foreground">교사 검토·편집</h3><span className="text-xs text-muted">{state.provider} · {state.model}</span></div>
          <p className="mt-1 text-sm text-warning">아직 저장되지 않은 AI 제안입니다. 아래 내용을 확인하고 수정한 뒤 초안으로 저장하세요.</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-foreground md:col-span-2">활동명<input required name="title" maxLength={200} defaultValue={state.draft.title} className="rounded-lg border border-border bg-background px-3 py-2" /></label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">학년<input name="grade" type="number" min="1" max="12" defaultValue={state.draft.grade ?? ""} className="rounded-lg border border-border bg-background px-3 py-2" /></label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">교과<input name="subject" maxLength={100} defaultValue={state.draft.subject ?? ""} className="rounded-lg border border-border bg-background px-3 py-2" /></label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">영역<input name="domain" maxLength={200} defaultValue={state.draft.domain ?? ""} className="rounded-lg border border-border bg-background px-3 py-2" /></label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">단원<input name="unit" maxLength={200} defaultValue={state.draft.unit ?? ""} className="rounded-lg border border-border bg-background px-3 py-2" /></label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">활동 유형<input name="activityType" maxLength={100} defaultValue={state.draft.activity_type ?? ""} className="rounded-lg border border-border bg-background px-3 py-2" /></label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">이전 차시<select name="parentActivityId" defaultValue="" className="rounded-lg border border-border bg-background px-3 py-2"><option value="">없음 — 첫 차시</option>{parentOptions.map((parent) => <option key={parent.id} value={parent.id}>{parent.title} ({parent.status === "ACTIVE" ? "활성" : "초안"})</option>)}</select></label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground md:col-span-2">활동 설명<textarea required name="description" maxLength={5000} rows={3} defaultValue={state.draft.description} className="rounded-lg border border-border bg-background px-3 py-2" /></label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground md:col-span-2">학생 안내문<textarea required name="instructions" maxLength={3000} rows={3} defaultValue={state.draft.instructions} className="rounded-lg border border-border bg-background px-3 py-2" /></label>
          </div>

          <div className="mt-5">
            <h4 className="text-sm font-bold text-foreground">성취기준 후보</h4>
            {state.standardOptions.length > 0 ? <div className="mt-2 space-y-2">{state.standardOptions.map((standard) => <label key={standard.id} className="flex items-start gap-2 rounded-xl border border-border p-3 text-sm"><input type="checkbox" name="standardIds" value={standard.id} defaultChecked={state.draft?.standard_candidates.includes(standard.id)} className="mt-0.5" /><span><strong>{standard.id}</strong> · {standard.description}</span></label>)}</div> : <p className="mt-2 text-sm text-muted">좁힌 후보가 없어 성취기준 없이 저장됩니다. 필요하면 저장 후 직접 연결하세요.</p>}
          </div>

          <input type="hidden" name="questionCount" value={state.draft.questions.length} />
          <div className="mt-5 space-y-3">
            <h4 className="text-sm font-bold text-foreground">문항</h4>
            {state.draft.questions.map((question, index) => (
              <fieldset key={question.question_id} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[100px_180px_1fr]">
                <input type="hidden" name={`questions.${index}.questionId`} value={question.question_id} />
                <div className="text-sm font-bold text-brand-700">{question.question_id}</div>
                <label className="grid gap-1.5 text-xs font-medium text-foreground">응답 유형<select name={`questions.${index}.questionType`} defaultValue={question.question_type} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">{AI_QUESTION_TYPES.map((type) => <option key={type} value={type}>{AI_QUESTION_TYPE_LABEL[type]}</option>)}</select></label>
                <label className="grid gap-1.5 text-xs font-medium text-foreground">문항<textarea required name={`questions.${index}.prompt`} maxLength={2000} rows={2} defaultValue={question.prompt} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
                <label className="grid gap-1.5 text-xs font-medium text-foreground md:col-start-3">객관식 보기 <span className="font-normal text-muted">(한 줄에 하나)</span><textarea name={`questions.${index}.options`} rows={Math.max(2, question.options.length)} defaultValue={question.options.join("\n")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
              </fieldset>
            ))}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-foreground">인쇄 방향<select name="orientation" defaultValue={state.draft.print_layout_data.orientation} className="rounded-lg border border-border bg-background px-3 py-2"><option value="PORTRAIT">A4 세로</option><option value="LANDSCAPE">A4 가로</option></select></label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">예상 페이지<input required name="estimatedPages" type="number" min="1" max="10" defaultValue={state.draft.print_layout_data.estimated_pages} className="rounded-lg border border-border bg-background px-3 py-2" /></label>
          </div>
          <div className="mt-6 flex justify-end"><button type="submit" className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700">검토한 내용을 Activity 초안으로 저장</button></div>
        </form>
      )}
    </section>
  );
}
