"use client";

import { useState } from "react";
import { Search, Bell, CircleHelp, ChevronDown, Plus } from "lucide-react";
import { AddMaterialModal } from "./AddMaterialModal";

/**
 * TopBar (TRD §33)
 * [Greeting 2줄] [Global Search] [Notification Badge] [Help] [User Menu]
 * [+ 학습자료 추가] — 전역 Primary Action, 우측 정렬, 모든 보호 Route 상시 노출
 */
export function TopBar({
  teacherName = "선생님",
  reviewPendingCount = 0,
}: {
  teacherName?: string;
  reviewPendingCount?: number;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="flex h-16 items-center gap-4 px-6">
        {/* Greeting 2줄 */}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">
            안녕하세요, {teacherName} 선생님!
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

        {/* Notification — 검토 대기 건수 Badge */}
        <button
          type="button"
          className="relative rounded-xl p-2 text-muted transition-colors duration-200 hover:bg-neutral-bg hover:text-foreground"
          aria-label={`알림 · 검토 대기 ${reviewPendingCount}건`}
        >
          <Bell className="h-5 w-5" />
          {reviewPendingCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {reviewPendingCount > 99 ? "99+" : reviewPendingCount}
            </span>
          )}
        </button>

        {/* Help */}
        <button
          type="button"
          className="rounded-xl p-2 text-muted transition-colors duration-200 hover:bg-neutral-bg hover:text-foreground"
          aria-label="도움말"
        >
          <CircleHelp className="h-5 w-5" />
        </button>

        {/* User Menu */}
        <button
          type="button"
          className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-neutral-bg"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
            {teacherName.slice(0, 1)}
          </span>
          <span className="hidden lg:inline">{teacherName} 선생님</span>
          <ChevronDown className="h-4 w-4 text-muted" />
        </button>

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
