"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Protected Shell identity was already verified by the server layout. */
export function SidebarAccount({ displayName }: { displayName: string }) {
  const router = useRouter();

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="border-t border-line px-4 py-4">
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
    </div>
  );
}
