"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  ClipboardCheck,
  BarChart3,
  Users,
  Megaphone,
  Settings,
  CircleHelp,
} from "lucide-react";
import { TraceWordmark } from "./TraceWordmark";

/**
 * Sidebar 확정 메뉴 (TRD §32)
 * 라벨은 프로토타입 확정본, 내부 라우트는 /results /analysis 유지.
 * 라벨과 라우트를 함께 바꾸지 않는다.
 */
const MAIN_NAV = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/results", label: "학습관리", icon: FolderOpen },
  { href: "/analysis", label: "평가관리", icon: ClipboardCheck },
  { href: "/reports", label: "리포트", icon: BarChart3 },
  { href: "/classes", label: "클래스 관리", icon: Users },
] as const;

const SUB_NAV = [
  { href: "/settings", label: "설정", icon: Settings, disabled: true },
  { href: "/help", label: "도움말", icon: CircleHelp, disabled: true },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex h-16 items-center px-6">
        <TraceWordmark />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {MAIN_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-muted hover:bg-neutral-bg hover:text-foreground"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </Link>
          );
        })}

        {/* 공지사항 — 비활성(준비 중), 라우트 없음 (TRD §32) */}
        <span
          aria-disabled
          className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted/50"
        >
          <Megaphone className="h-[18px] w-[18px]" />
          공지사항
          <span className="ml-auto rounded-full bg-neutral-bg px-1.5 py-0.5 text-[10px] font-bold text-muted">
            준비 중
          </span>
        </span>

        <div className="my-3 border-t border-line" />

        {SUB_NAV.map(({ href, label, icon: Icon, disabled }) =>
          disabled ? (
            <span
              key={href}
              aria-disabled
              className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted/50"
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </span>
          ) : (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition-colors duration-200 hover:bg-neutral-bg hover:text-foreground"
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </Link>
          ),
        )}
      </nav>

      {/* 개인정보처리방침 — 하단 고정, Modal (MVP: 안내 문구) */}
      <div className="border-t border-line px-6 py-4">
        <button
          type="button"
          className="text-xs font-medium text-muted transition-colors duration-200 hover:text-foreground"
        >
          개인정보처리방침
        </button>
      </div>
    </aside>
  );
}
