import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { Footer } from "@/components/shell/Footer";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";

export const metadata: Metadata = { title: "로그인" };

/**
 * 로그인 /login (TRD §9)
 * 진입점은 [Google로 계속하기] 하나. 회원가입/로그인을 나누지 않는다.
 * 신규 사용자의 첫 Google 인증은 회원가입을 겸한다.
 */

const FEATURES = [
  {
    icon: ScanLine,
    title: "넣기만 하면 정리돼요",
    description: "종이 활동지 촬영, 파일 업로드 — 이미 있는 자료가 하나의 흐름으로 연결됩니다.",
  },
  {
    icon: Sparkles,
    title: "성취기준에 근거한 AI 분석",
    description: "강점·어려움·근거를 성취수준 기준으로 정리한 초안을 받아보세요.",
  },
  {
    icon: BadgeCheck,
    title: "확정은 오직 선생님의 승인으로",
    description: "AI는 보조자일 뿐, 모든 교육적 판단은 선생님의 검토를 거쳐 기록됩니다.",
  },
] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error
    ? "로그인 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요."
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="flex flex-1">
        {/* 좌측 브랜드 패널 (데스크톱) */}
        <section className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-12 text-white lg:flex">
          {/* 장식 요소 */}
          <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-brand-400/25 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute right-16 top-24 h-2.5 w-2.5 rounded-full bg-white/60" />
          <div aria-hidden className="pointer-events-none absolute right-28 top-40 h-1.5 w-1.5 rounded-full bg-white/40" />

          <div className="relative">
            <span className="inline-flex items-baseline gap-1 select-none">
              <span className="text-2xl font-extrabold tracking-[0.22em]">TRACE</span>
              <span className="h-2 w-2 translate-y-[-2px] rounded-full bg-white/80" />
            </span>
          </div>

          <div className="relative max-w-md">
            <h1 className="text-[2.5rem] font-bold leading-tight tracking-tight">
              흩어진 학습자료가
              <br />
              성장의 근거가 됩니다
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/80">
              학생의 결과물을 모으고, 성취기준으로 분석하고,
              <br />
              선생님의 승인으로 성장을 누적하는 기록 시스템.
            </p>

            <ul className="mt-10 space-y-6">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex gap-4">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{title}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-white/70">
                      {description}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative flex items-center gap-2 text-xs text-white/70">
            <ShieldCheck className="h-4 w-4" />
            학생 이름과 번호는 AI로 전송되지 않습니다 · 서울특별시교육청
          </p>
        </section>

        {/* 우측 로그인 영역 */}
        <section className="flex w-full items-center justify-center px-6 py-12 lg:w-[54%]">
          <div className="w-full max-w-sm">
            <div className="flex justify-center lg:justify-start">
              <Image
                src="/trace-logo-horizontal-v1.png"
                alt="TRACE"
                width={2073}
                height={758}
                priority
                className="h-auto w-40"
              />
            </div>

            <h2 className="mt-10 text-center text-2xl font-bold tracking-tight text-foreground lg:text-left">
              선생님, 환영해요
            </h2>
            <p className="mt-2 text-center text-sm leading-relaxed text-muted lg:text-left">
              학교 구글 계정으로 시작하세요.
              <br className="lg:hidden" /> 별도 회원가입 없이 첫 로그인이 곧 가입이에요.
            </p>

            {/* 모바일 전용 핵심 가치 한 줄 */}
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted lg:hidden">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
              학생 이름과 번호는 AI로 전송되지 않습니다
            </p>

            <div className="mt-8">
              <GoogleLoginButton />
            </div>

            {errorMessage && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-center text-sm text-danger"
              >
                {errorMessage}
              </p>
            )}

            <p className="mt-8 text-center text-xs leading-relaxed text-muted lg:text-left">
              계속 진행하면 TRACE의{" "}
              <Link href="/terms" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
                이용약관
              </Link>
              과{" "}
              <Link href="/privacy" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
                개인정보처리방침
              </Link>
              에 동의하는 것으로 간주돼요.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
