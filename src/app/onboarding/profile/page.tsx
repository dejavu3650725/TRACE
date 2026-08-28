import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TraceWordmark } from "@/components/shell/TraceWordmark";
import { getSessionTeacher } from "@/lib/auth/teacher";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "프로필 설정" };

/**
 * 최초 로그인 온보딩 /onboarding/profile
 * 로그인 안 됨 → /login, Profile 이미 있음 → /dashboard (무한 루프 방지 분기)
 */
export default async function OnboardingProfilePage() {
  const { userId, teacher } = await getSessionTeacher();
  if (!userId) redirect("/login");
  if (teacher) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
        <div className="flex justify-center">
          <TraceWordmark href="#" />
        </div>
        <h1 className="mt-6 text-xl font-bold text-foreground">
          TRACE에 오신 것을 환영해요
        </h1>
        <p className="mt-2 text-sm text-muted">선생님의 기본 정보를 알려주세요.</p>
        <ProfileForm />
      </div>
    </main>
  );
}
