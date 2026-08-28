"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  ClipboardCheck,
  BarChart3,
  Users,
  ShieldCheck,
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

export function Sidebar() {
  const pathname = usePathname();
  const adminActive = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex h-20 items-center px-6">
        <TraceWordmark />
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-3">
        {MAIN_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3.5 rounded-xl px-4 py-3.5 text-[15px] font-semibold transition-colors duration-200 ${
                active
                  ? "bg-brand-50 text-brand-700 shadow-[inset_0_0_0_1px_var(--brand-100)]"
                  : "text-muted hover:bg-neutral-bg hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* 관리자 — 학교 단위 운영 관리 콘솔 */}
      <div className="border-t border-line px-4 py-4">
        <Link
          href="/admin"
          className={`flex items-center gap-3.5 rounded-xl px-4 py-3.5 text-[15px] font-semibold transition-colors duration-200 ${
            adminActive
              ? "bg-brand-50 text-brand-700 shadow-[inset_0_0_0_1px_var(--brand-100)]"
              : "text-muted hover:bg-neutral-bg hover:text-foreground"
          }`}
        >
          <ShieldCheck className="h-5 w-5" />
          관리자
        </Link>
      </div>
    </aside>
  );
}
