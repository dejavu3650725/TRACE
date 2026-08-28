"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogIn, LogOut, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { getTeacherDisplayName } from "@/shared/displayName";

type Status = "loading" | "signedOut" | "signedIn";

/**
 * Sidebar 하단 계정 영역.
 * 비로그인 → [Google로 로그인] 버튼 → 로그인 모달
 * 로그인 → 표시 이름 + 로그아웃
 */
export function SidebarAccount() {
  const [status, setStatus] = useState<Status>("loading");
  const [displayName, setDisplayName] = useState("선생님");
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setStatus("signedOut");
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        setStatus("signedOut");
        return;
      }

      const { data: teacher } = await supabase
        .from("teachers")
        .select("name, nickname")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (cancelled) return;

      setDisplayName(teacher ? getTeacherDisplayName(teacher) : "선생님");
      setStatus("signedIn");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <div className="border-t border-line px-4 py-4">
      {status === "signedIn" ? (
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {displayName.slice(0, 1)}
            </span>
            <span className="truncate text-sm font-semibold text-foreground">
              {displayName}
            </span>
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-neutral-bg hover:text-foreground"
            aria-label="로그아웃"
            title="로그아웃"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={status === "loading"}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-neutral-bg disabled:opacity-50"
        >
          <LogIn className="h-4 w-4" />
          Google로 로그인
        </button>
      )}

      {modalOpen &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal
              aria-label="Google 로그인"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-extrabold tracking-[0.18em] text-brand-600">
                  TRACE
                </span>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-neutral-bg hover:text-foreground"
                  aria-label="닫기"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <h2 className="mt-5 text-lg font-bold text-foreground">
                Google 계정으로 시작하세요
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                별도 회원가입 없이, 첫 로그인이 곧 가입이에요.
              </p>
              <div className="mt-6">
                <GoogleLoginButton />
              </div>
              <p className="mt-5 text-xs text-muted">
                계속 진행하면 이용약관과 개인정보처리방침에 동의하는 것으로 간주돼요.
              </p>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
