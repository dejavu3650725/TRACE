import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 서버 전용 Admin Client (service_role).
 * 학생 공개 제출 경로처럼 세션이 없는 요청을 서버가 대신 검증할 때만 쓴다.
 * - 절대 클라이언트 번들로 내보내지 않는다 ("server-only" 가드).
 * - 모든 사용처는 직접 소유권/토큰 검증을 수행해야 한다 (RLS 우회이므로).
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured (server-only env). 학생 공개 제출 기능에 필요합니다.",
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
