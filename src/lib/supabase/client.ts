"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * 브라우저(Client Component)용 Supabase 클라이언트.
 * anon key만 사용한다. Service Role/AI Key는 절대 클라이언트에 두지 않는다 (TRD §30.10).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
