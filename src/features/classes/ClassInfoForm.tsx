"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { updateClassInfo, type ClassFormState } from "./actions";

const initialState: ClassFormState = { status: "idle", message: null, savedAt: null };

/**
 * 학급 정보 폼 — 저장 피드백을 버튼 자체로 보여준다.
 * 클릭 → "저장 중..."(스피너) → 성공 시 초록 "✓ 저장 완료" 2.5초 → 원상 복귀
 */
export function ClassInfoForm({
  classId,
  name,
  grade,
  subject,
}: {
  classId: string;
  name: string;
  grade: number | null;
  subject: string | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateClassInfo, initialState);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (state.status === "success" && state.savedAt) {
      setShowSuccess(true);
      router.refresh(); // 페이지 제목 등 서버 렌더 영역도 새 이름으로 갱신
      const timer = setTimeout(() => setShowSuccess(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [state.status, state.savedAt, router]);

  const buttonClass = showSuccess
    ? "bg-success hover:bg-success"
    : "bg-brand-600 hover:bg-brand-700";

  return (
    <form action={formAction} className="mt-4 grid gap-4 md:grid-cols-3">
      <input type="hidden" name="classId" value={classId} />
      <label className="grid gap-1.5 text-sm font-medium text-foreground">
        학급명/반
        <input
          required
          name="name"
          maxLength={100}
          defaultValue={name}
          className="rounded-lg border border-line bg-background px-3 py-2 outline-none transition-colors duration-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-foreground">
        학년 <span className="font-normal text-muted">(선택)</span>
        <input
          name="grade"
          type="number"
          min="1"
          max="12"
          defaultValue={grade ?? ""}
          className="rounded-lg border border-line bg-background px-3 py-2 outline-none transition-colors duration-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-foreground">
        교과 <span className="font-normal text-muted">(선택)</span>
        <input
          name="subject"
          maxLength={100}
          defaultValue={subject ?? ""}
          className="rounded-lg border border-line bg-background px-3 py-2 outline-none transition-colors duration-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </label>

      <div className="flex items-center justify-end gap-3 md:col-span-3">
        {state.status === "error" && state.message && (
          <p role="alert" className="text-sm font-medium text-danger">
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className={`inline-flex min-w-36 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-300 disabled:opacity-70 ${buttonClass}`}
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              저장 중...
            </>
          ) : showSuccess ? (
            <>
              <Check className="h-4 w-4" />
              저장 완료
            </>
          ) : (
            "저장"
          )}
        </button>
      </div>
    </form>
  );
}
