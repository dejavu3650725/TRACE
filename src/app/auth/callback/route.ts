import { NextResponse } from "next/server";
import { recordLoginAudit } from "@/lib/auth/audit";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth Callback /auth/callback (TRD §9, §30.1)
 * Google OAuth code → Supabase 세션 교환 후,
 * Teacher Profile 유무에 따라 온보딩 또는 대시보드로 보낸다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: teacher, error: teacherError } = await supabase
          .from("teachers")
          .select("id")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (teacherError) {
          return NextResponse.redirect(`${origin}/login?error=auth`);
        }

        if (teacher) {
          try {
            await recordLoginAudit(supabase);
          } catch {
            return NextResponse.redirect(`${origin}/login?error=audit`);
          }
        }

        return NextResponse.redirect(
          `${origin}${teacher ? "/dashboard" : "/onboarding/profile"}`,
        );
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
