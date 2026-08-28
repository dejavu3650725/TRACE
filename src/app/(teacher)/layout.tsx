import { redirect } from "next/navigation";
import { TeacherAppShell } from "@/components/shell/TeacherAppShell";
import { getSessionTeacher } from "@/lib/auth/teacher";
import { getTeacherDisplayName } from "@/shared/displayName";

/**
 * 보호된 Teacher Layout (TRD §52 Merge Gate)
 * 진입 규칙:
 *   로그인 안 됨 → /login
 *   로그인됨 + Teacher Profile 없음 → /onboarding/profile
 *   로그인됨 + Profile 있음 → 통과 (개인화 이름 표시)
 * 초기 개발 편의: NEXT_PUBLIC_AUTH_BYPASS=true면 세션 검사를 건너뛴다.
 * Google OAuth Provider 설정이 끝나면 반드시 false로 바꾼다.
 */
export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let displayName = "선생님";

  const bypass = process.env.NEXT_PUBLIC_AUTH_BYPASS === "true";
  const hasSupabaseEnv = Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY),
  );

  if (!bypass && hasSupabaseEnv) {
    const { userId, teacher } = await getSessionTeacher();
    if (!userId) redirect("/login");
    if (!teacher) redirect("/onboarding/profile");
    displayName = getTeacherDisplayName(teacher);
  }

  return <TeacherAppShell displayName={displayName}>{children}</TeacherAppShell>;
}
