import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth Callback /auth/callback (TRD §9, §30.1)
 * Google OAuth code → Supabase 세션 교환 후 대시보드로.
 * Teacher Profile 생성/조회(teachers.auth_user_id 연결)는 이후 서버 로직에서 처리한다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // TODO(Shared): teachers 테이블에 auth_user_id 기준 Teacher Profile upsert
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
