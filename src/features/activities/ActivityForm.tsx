"use client";

import { useActionState, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import {
  createActivity,
  searchActivityStandards,
  updateActivity,
  type StandardOption,
  type StandardsSearchState,
} from "./actions";
import {
  CURRICULUM_SCHOOL_LEVELS,
  gradeBandForNumericGrade,
  gradeBandsForSchoolLevel,
  schoolLevelForNumericGrade,
  type CurriculumSchoolLevel,
} from "./curriculum";

type ActivityValues = {
  id?: string;
  title: string;
  grade: number | null;
  subject: string | null;
  domain: string | null;
  unit: string | null;
  activity_type: string | null;
  description: string | null;
  parent_activity_id: string | null;
};

type ParentOption = { id: string; title: string; status: string };

export function ActivityForm({
  mode,
  activity,
  parentOptions,
  initialCandidates,
  initialSelected,
}: {
  mode: "create" | "edit";
  activity: ActivityValues;
  parentOptions: ParentOption[];
  initialCandidates: StandardOption[];
  initialSelected: StandardOption[];
}) {
  const [selected, setSelected] = useState<StandardOption[]>(initialSelected);
  const initialSchoolLevel = schoolLevelForNumericGrade(activity.grade);
  const initialGradeBand = gradeBandForNumericGrade(activity.grade);
  const [searchSchoolLevel, setSearchSchoolLevel] = useState<CurriculumSchoolLevel | "">(
    initialSchoolLevel ?? "",
  );
  const [searchGrade, setSearchGrade] = useState(initialGradeBand ?? "");
  const [searchSubject, setSearchSubject] = useState(
    initialSchoolLevel === "고등학교" ? "정보" : activity.subject ?? "",
  );
  const initialSearchState: StandardsSearchState = {
    candidates: initialCandidates,
    message: null,
    schoolLevel: initialSchoolLevel,
    grade: initialGradeBand,
  };
  const [searchState, searchAction, searchPending] = useActionState(
    searchActivityStandards,
    initialSearchState,
  );
  const saveAction = mode === "create" ? createActivity : updateActivity;
  const visibleCandidates =
    searchState.schoolLevel === (searchSchoolLevel || null) && searchState.grade === (searchGrade || null)
      ? searchState.candidates
      : [];

  function changeSearchSchoolLevel(value: string) {
    const nextSchoolLevel = CURRICULUM_SCHOOL_LEVELS.find((item) => item === value) ?? "";
    setSearchSchoolLevel(nextSchoolLevel);
    setSearchGrade("");
    setSearchSubject(nextSchoolLevel === "고등학교" ? "정보" : "");
  }

  function addStandard(standard: StandardOption) {
    setSelected((current) =>
      current.some((item) => item.id === standard.id) ? current : [...current, standard],
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-bold text-foreground">성취기준 검색</h2>
        <p className="mt-1 text-sm text-muted">공유 교육과정 원문에서 검색하고 활동에 연결할 기준을 선택하세요.</p>
        <form action={searchAction} className="mt-4 grid gap-3 md:grid-cols-[150px_160px_180px_1fr_auto]">
          <select
            required
            name="searchSchoolLevel"
            value={searchSchoolLevel}
            onChange={(event) => changeSearchSchoolLevel(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">학교급 선택</option>
            {CURRICULUM_SCHOOL_LEVELS.map((schoolLevel) => (
              <option key={schoolLevel} value={schoolLevel}>{schoolLevel}</option>
            ))}
          </select>
          <select
            required
            name="searchGrade"
            value={searchGrade}
            disabled={!searchSchoolLevel}
            onChange={(event) => setSearchGrade(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">학년군 선택</option>
            {(searchSchoolLevel ? gradeBandsForSchoolLevel(searchSchoolLevel) : []).map((gradeBand) => (
              <option key={gradeBand} value={gradeBand}>{gradeBand}</option>
            ))}
          </select>
          <input
            name="searchSubject"
            maxLength={100}
            value={searchSubject}
            readOnly={searchSchoolLevel === "고등학교"}
            onChange={(event) => setSearchSubject(event.target.value)}
            placeholder="교과 (예: 국어)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            name="keyword"
            maxLength={100}
            placeholder="성취기준 코드나 핵심어"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={searchPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-600 px-4 py-2 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
          >
            <Search className="h-4 w-4" /> {searchPending ? "검색 중" : "검색"}
          </button>
        </form>
        {searchState.message && <p className="mt-3 text-sm text-warning">{searchState.message}</p>}
        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
          {visibleCandidates.map((standard) => {
            const alreadySelected = selected.some((item) => item.id === standard.id);
            return (
              <div key={standard.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{standard.id} · {standard.subject} · {standard.grade}</p>
                  <p className="mt-1 text-xs text-muted">{standard.domain}</p>
                  <p className="mt-1 text-sm text-foreground">{standard.description}</p>
                </div>
                <button
                  type="button"
                  disabled={alreadySelected}
                  onClick={() => addStandard(standard)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 disabled:bg-neutral-bg disabled:text-muted"
                >
                  <Plus className="h-3.5 w-3.5" /> {alreadySelected ? "선택됨" : "선택"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <form action={saveAction} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        {activity.id && <input type="hidden" name="activityId" value={activity.id} />}
        {selected.map((standard) => (
          <input key={standard.id} type="hidden" name="standardIds" value={standard.id} />
        ))}

        <h2 className="font-bold text-foreground">활동 정보</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-foreground md:col-span-2">
            활동명
            <input required name="title" maxLength={200} defaultValue={activity.title} className="rounded-lg border border-border bg-background px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            학년 <span className="font-normal text-muted">(선택)</span>
            <input name="grade" type="number" min="1" max="12" defaultValue={activity.grade ?? ""} className="rounded-lg border border-border bg-background px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            교과 <span className="font-normal text-muted">(선택)</span>
            <input name="subject" maxLength={100} defaultValue={activity.subject ?? ""} placeholder="예: 국어" className="rounded-lg border border-border bg-background px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            영역 <span className="font-normal text-muted">(선택)</span>
            <input name="domain" maxLength={200} defaultValue={activity.domain ?? ""} className="rounded-lg border border-border bg-background px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            단원 <span className="font-normal text-muted">(선택)</span>
            <input name="unit" maxLength={200} defaultValue={activity.unit ?? ""} className="rounded-lg border border-border bg-background px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            활동 유형 <span className="font-normal text-muted">(선택)</span>
            <input name="activityType" maxLength={100} defaultValue={activity.activity_type ?? ""} placeholder="예: 활동지, 수행과제" className="rounded-lg border border-border bg-background px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            이전 차시 <span className="font-normal text-muted">(선택)</span>
            <select name="parentActivityId" defaultValue={activity.parent_activity_id ?? ""} className="rounded-lg border border-border bg-background px-3 py-2">
              <option value="">없음 — 첫 차시</option>
              {parentOptions.map((parent) => (
                <option key={parent.id} value={parent.id}>{parent.title} ({parent.status === "ACTIVE" ? "활성" : "초안"})</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground md:col-span-2">
            활동 목적·설명 <span className="font-normal text-muted">(선택)</span>
            <textarea name="description" maxLength={5000} rows={5} defaultValue={activity.description ?? ""} className="rounded-lg border border-border bg-background px-3 py-2" />
          </label>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-foreground">선택한 성취기준</h3>
            <span className="text-xs text-muted">{selected.length}개</span>
          </div>
          {selected.length > 0 ? (
            <div className="mt-2 space-y-2">
              {selected.map((standard) => (
                <div key={standard.id} className="flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-3 py-2">
                  <span className="text-sm text-brand-800">{standard.id} · {standard.description}</span>
                  <button type="button" onClick={() => setSelected((items) => items.filter((item) => item.id !== standard.id))} aria-label={`${standard.id} 연결 해제`} className="shrink-0 rounded-md p-1 text-brand-700 hover:bg-brand-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 rounded-xl bg-background px-3 py-3 text-sm text-muted">성취기준 연결은 선택사항이에요.</p>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button type="submit" className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700">
            {mode === "create" ? "초안 저장" : "변경사항 저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
