"use client";

import Link from "next/link";

export interface TabItem {
  key: string;
  label: string;
  href?: string;
  count?: number;
}

/** 페이지 내부 탭 내비게이션 (예: 학습관리의 활동/학생별/검토 대기) */
export function TabNav({
  items,
  activeKey,
  onChange,
}: {
  items: TabItem[];
  activeKey: string;
  onChange?: (key: string) => void;
}) {
  return (
    <nav className="flex gap-1 border-b border-line">
      {items.map((item) => {
        const active = item.key === activeKey;
        const cls = `relative -mb-px inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${
          active
            ? "border-b-2 border-brand-600 text-brand-700"
            : "border-b-2 border-transparent text-muted hover:text-foreground"
        }`;
        const inner = (
          <>
            {item.label}
            {typeof item.count === "number" && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                  active ? "bg-brand-50 text-brand-700" : "bg-neutral-bg text-muted"
                }`}
              >
                {item.count}
              </span>
            )}
          </>
        );
        return item.href ? (
          <Link key={item.key} href={item.href} className={cls}>
            {inner}
          </Link>
        ) : (
          <button key={item.key} type="button" onClick={() => onChange?.(item.key)} className={cls}>
            {inner}
          </button>
        );
      })}
    </nav>
  );
}
