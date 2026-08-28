"use client";

import { ChevronDown } from "lucide-react";

/**
 * 페이지 단위 FilterBar에서 사용하는 Class Selector (TRD §33).
 * School Selector는 만들지 않는다.
 */
export function ClassSelector({
  classes,
  value,
  onChange,
  placeholder = "학급 선택",
}: {
  classes: Array<{ id: string; name: string }>;
  value?: string;
  onChange?: (classId: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="relative inline-flex items-center">
      <select
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="appearance-none rounded-xl border border-line bg-surface py-2 pl-3.5 pr-9 text-sm font-medium text-foreground shadow-sm outline-none transition-colors duration-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted" />
    </label>
  );
}
