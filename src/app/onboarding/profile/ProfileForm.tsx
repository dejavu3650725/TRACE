"use client";

import { useActionState } from "react";
import { createTeacherProfile, type ProfileFormState } from "./actions";

const initialState: ProfileFormState = { error: null };

export function ProfileForm() {
  const [state, formAction, pending] = useActionState(createTeacherProfile, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-4 text-left">
      <label className="block">
        <span className="text-sm font-semibold text-foreground">
          이름 <span className="text-danger">*</span>
        </span>
        <input
          name="name"
          type="text"
          required
          maxLength={30}
          placeholder="예: 김혜진"
          className="mt-1.5 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm outline-none transition-colors duration-200 placeholder:text-muted focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-foreground">
          닉네임 <span className="font-normal text-muted">(선택)</span>
        </span>
        <input
          name="nickname"
          type="text"
          maxLength={30}
          placeholder="예: 혜진쌤"
          className="mt-1.5 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm outline-none transition-colors duration-200 placeholder:text-muted focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </label>

      {state.error && <p className="text-xs text-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "저장 중..." : "TRACE 시작하기"}
      </button>
    </form>
  );
}
