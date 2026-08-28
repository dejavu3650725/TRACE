"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Bell, CircleHelp, ChevronDown, Plus, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AddMaterialModal } from "./AddMaterialModal";

/**
 * TopBar (TRD §33)
 * [Greeting 2줄] [Global Search] [Notification Badge] [Help] [User Menu]
 * [+ 학습자료 추가] — 전역 Primary Action, 우측 정렬, 모든 보호 Route 상시 노출
 */
export function TopBar({
  displayName = "선생님",
  reviewPendingCount = 0,
}: {
  /** 개인화 표시 이름 — nickname 또는 "{name} 선생님" (shared/displayName.ts 규칙) */
  displayName?: string;
  reviewPendingCount?: number;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // 계정 메뉴 밖 클릭/ESC 시 닫기
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="flex h-16 items-center gap-4 px-6">
        {/* Greeting 2줄 */}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">
            안녕하세요, {displayName}!
          </p>
          <p className="truncate text-xs text-muted">
            오늘도 학생들의 성장을 함께 만들어요.
          </p>
        </div>

        {/* Global Search */}
        <label className="relative ml-auto hidden w-72 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="검색어를 입력하세요"
            className="w-full rounded-xl border border-line bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors duration-200 placeholder:text-muted focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        {/* Notification — 검토 대기 건수 Badge, 클릭 시 검토 대기 목록으로 이동 */}
        <Link
          href="/analysis"
          className="relative rounded-xl p-2 text-muted transition-colors duration-200 hover:bg-neutral-bg hover:text-foreground"
          aria-label={`알림 · 검토 대기 ${reviewPendingCount}건 — 검토하러 가기`}
          title={
            reviewPendingCount > 0
              ? `검토 대기 ${reviewPendingCount}건 — 검토하러 가기`
              : "검토 대기 없음"
          }
        >
          <Bell className="h-5 w-5" />
          {reviewPendingCount > 0 && (
            <span className="animate-badge absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {reviewPendingCount > 99 ? "99+" : reviewPendingCount}
            </span>
          )}
        </Link>

        {/* Help */}
        <button
          type="button"
          className="rounded-xl p-2 text-muted transition-colors duration-200 hover:bg-neutral-bg hover:text-foreground"
          aria-label="도움말"
        >
          <CircleHelp className="h-5 w-5" />
        </button>

        {/* User Menu — 계정 단일 진입점 (프로필·로그아웃) */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-neutral-bg"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {displayName.slice(0, 1)}
            </span>
            <span className="hidden lg:inline">{displayName}</span>
            <ChevronDown
              className={`h-4 w-4 text-muted transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card-hover)]"
            >
              <div className="border-b border-line px-4 py-3">
                <p className="truncate text-sm font-bold text-foreground">{displayName}</p>
                <p className="text-xs text-muted">Google 계정으로 로그인됨</p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={signOut}
                className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-neutral-bg"
              >
                <LogOut className="h-4 w-4 text-muted" />
                로그아웃
              </button>
            </div>
          )}
        </div>

        {/* 전역 Primary Action */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          학습자료 추가
        </button>
      </div>

      <AddMaterialModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </header>
  );
}
