import type { Metadata } from "next";
import { Footer } from "@/components/shell/Footer";
import { TraceWordmark } from "@/components/shell/TraceWordmark";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";

export const metadata: Metadata = { title: "로그인" };

/**
 * 로그인 /login (TRD §9)
 * 진입점은 [Google로 계속하기] 하나. 회원가입/로그인을 나누지 않는다.
 * 신규 사용자의 첫 Google 인증은 회원가입을 겸한다.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
        <div className="flex justify-center">
          <TraceWordmark href="/" />
        </div>
        <h1 className="mt-6 text-xl font-bold text-foreground">
          학생의 성장을 근거로 기록해요
        </h1>
        <p className="mt-2 text-sm text-muted">
          이미 쌓여 있는 학습자료를 하나의 흐름으로 연결하고,
          <br />
          교사가 승인한 근거로 성장을 누적해요.
        </p>
        <div className="mt-8">
          <GoogleLoginButton />
        </div>
        <p className="mt-6 text-xs text-muted">
          계속 진행하면 이용약관과 개인정보처리방침에 동의하는 것으로 간주돼요.
        </p>
      </div>
      </main>
      <Footer />
    </div>
  );
}
