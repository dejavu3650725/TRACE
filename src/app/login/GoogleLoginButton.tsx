"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** [Google로 계속하기] — Supabase Auth Google Provider (TRD §30.1) */
export function GoogleLoginButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      if (error) throw error;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "로그인에 실패했어요. 잠시 후 다시 시도해 주세요.",
      );
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors duration-200 hover:bg-neutral-bg disabled:opacity-60"
      >
        <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38Z"
          />
        </svg>
        {loading ? "이동 중..." : "Google로 계속하기"}
      </button>
      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
    </div>
  );
}
