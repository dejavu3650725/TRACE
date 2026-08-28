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
 * 개발·배포 환경 모두 동일하게 fail-closed로 검사한다.
 */
export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, teacher } = await getSessionTeacher();
  if (!userId) redirect("/login");
  if (!teacher) redirect("/onboarding/profile");
  const displayName = getTeacherDisplayName(teacher);

  return <TeacherAppShell displayName={displayName}>{children}</TeacherAppShell>;
}
