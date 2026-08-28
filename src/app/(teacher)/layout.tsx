import { redirect } from "next/navigation";
import { TeacherAppShell } from "@/components/shell/TeacherAppShell";
import { createClient } from "@/lib/supabase/server";

/**
 * 보호된 Teacher Layout (TRD §52 Merge Gate)
 * - Supabase 세션이 없으면 /login으로 보낸다 (TRD §30.1).
 * - 초기 개발 편의: NEXT_PUBLIC_AUTH_BYPASS=true면 세션 검사를 건너뛴다.
 *   Google OAuth Provider 설정이 끝나면 반드시 false로 바꾼다.
 */
export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let teacherName = "선생님";

  const bypass = process.env.NEXT_PUBLIC_AUTH_BYPASS === "true";
  const hasSupabaseEnv = Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY),
  );

  if (!bypass && hasSupabaseEnv) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    teacherName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email ??
      "선생님";
  }

  return <TeacherAppShell teacherName={teacherName}>{children}</TeacherAppShell>;
}
