import { NextResponse } from "next/server";
import { recordLoginAudit } from "@/lib/auth/audit";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth Callback /auth/callback (TRD §9, §30.1)
 * Google OAuth code → Supabase 세션 교환 후,
 * Teacher Profile 유무에 따라 온보딩 또는 대시보드로 보낸다.
 *
 * 원칙: 인증(세션 교환)이 성공했다면 부가 작업(감사 기록·프로필 조회)의 실패가
 * 로그인 자체를 되돌리지 않는다. 부가 실패는 서버 로그로만 남긴다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[AUTH] 세션 교환 실패:", error.message);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // Teacher Profile 유무 확인 — 조회 실패는 치명적이지 않다 (레이아웃이 재검증)
  let hasTeacher = false;
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (teacherError) {
    console.error("[AUTH] Teacher Profile 조회 실패:", teacherError.message);
    hasTeacher = true; // 대시보드로 보내고 레이아웃 가드가 다시 판단
  } else {
    hasTeacher = Boolean(teacher);
  }

  // LOGIN 감사 기록 — 베스트 에포트. 실패해도 로그인을 막지 않는다.
  if (teacher) {
    try {
      await recordLoginAudit(supabase);
    } catch (e) {
      console.error("[AUTH] LOGIN 감사 기록 실패(무시하고 진행):", e);
    }
  }

  return NextResponse.redirect(
    `${origin}${hasTeacher ? "/dashboard" : "/onboarding/profile"}`,
  );
}
