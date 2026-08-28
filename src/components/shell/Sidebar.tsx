"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  ClipboardCheck,
  BarChart3,
  Users,
} from "lucide-react";
import { TraceWordmark } from "./TraceWordmark";
import { SidebarAccount } from "@/components/auth/SidebarAccount";

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

export function Sidebar({ displayName }: { displayName: string }) {
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
      </nav>

      <SidebarAccount displayName={displayName} />
    </aside>
  );
}
