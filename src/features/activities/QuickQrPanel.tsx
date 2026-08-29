"use client";

import { useActionState, useState } from "react";
import { Camera, Loader2, Sparkles } from "lucide-react";
import { createQrFromWorksheet, type QuickQrState } from "./quick-qr";

const initialState: QuickQrState = { status: "idle", message: null };

/**
 * 빈 활동지 사진 한 장 → AI 성취기준 연결 → 활동 생성 → 즉시 QR.
 * 교사의 수업 구상이 사진 한 장으로 시작된다 (킥 1).
 */
export function QuickQrPanel({
  classes,
}: {
  classes: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState(createQrFromWorksheet, initialState);
  const [fileName, setFileName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  if (classes.length === 0) return null;

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        // hidden+required 파일 입력은 브라우저가 제출을 '조용히' 막는다 — 직접 검사해 안내한다.
        const photo = e.currentTarget.elements.namedItem("photo") as HTMLInputElement | null;
        if (!photo?.files?.length) {
          e.preventDefault();
          setLocalError("활동지 사진이나 PDF 파일을 먼저 선택해 주세요.");
          return;
        }
        setLocalError(null);
      }}
      className="rounded-2xl border border-brand-200 bg-gradient-to-b from-brand-50/70 to-surface p-5 shadow-[var(--shadow-card)]"
    >
      <p className="flex items-center gap-1.5 text-sm font-bold text-brand-700">
        <Sparkles className="h-4 w-4" /> 빈 활동지로 바로 QR 만들기
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        활동지 사진이나 PDF를 올리면 AI가 2022 교육과정에서 맞는 성취기준을 찾아 활동을 만들고, 그
        자리에서 학생 제출 QR을 발급해요.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          name="classId"
          required
          className="min-w-40 rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-semibold"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-foreground hover:bg-neutral-bg">
          <Camera className="h-4 w-4 text-brand-600" />
          {fileName ? `${fileName.slice(0, 18)}${fileName.length > 18 ? "…" : ""}` : "활동지 사진/PDF 선택"}
          <input
            type="file"
            name="photo"
            accept="image/*,.pdf,application/pdf"
            hidden
            onChange={(e) => {
              setFileName(e.target.files?.[0]?.name ?? null);
              if (e.target.files?.length) setLocalError(null);
            }}
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> AI가 성취기준 연결 중…
            </>
          ) : (
            "활동 만들고 QR 발급"
          )}
        </button>
      </div>

      {(localError || (state.status === "error" && state.message)) && (
        <p className="mt-3 rounded-xl border border-danger/20 bg-danger-bg px-4 py-2.5 text-sm text-danger">
          {localError ?? state.message}
        </p>
      )}
    </form>
  );
}
