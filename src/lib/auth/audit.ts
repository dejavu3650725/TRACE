import "server-only";

import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Writes the fixed, PII-free LOGIN audit shape defined by ISSUE-03. */
export async function recordLoginAudit(supabase: ServerSupabaseClient) {
  const { error } = await supabase.rpc("record_login");
  if (error) throw new Error("LOGIN audit persistence failed", { cause: error });
}
