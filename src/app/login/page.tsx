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
 * 디자인: 종이 프로토타입의 라이트 톤 — 밝은 배경, 흰 카드, 파스텔 아이콘 칩,
 * 핵심 구절만 브랜드 블루로 강조하는 펀치라인.
 */

const FEATURES = [
  {
    icon: ScanLine,
    iconClass: "bg-brand-50 text-brand-600",
    title: "넣기만 하면 정리돼요",
    description: "촬영·업로드한 자료가 학생별로 연결됩니다",
  },
  {
    icon: Sparkles,
    iconClass: "bg-violet-50 text-violet-500",
    title: "성취기준에 근거한 분석",
    description: "강점·어려움·근거를 담은 AI 초안을 받아보세요",
  },
  {
    icon: BadgeCheck,
    iconClass: "bg-emerald-50 text-emerald-500",
    title: "확정은 선생님의 승인으로",
    description: "모든 교육적 판단은 검토를 거쳐 기록됩니다",
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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f7f9fd]">
      {/* 은은한 배경 장식 — 프로토타입의 라이트 블루 무드 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-gradient-to-b from-brand-50/80 to-transparent"
      />
      <div aria-hidden className="pointer-events-none absolute left-[12%] top-40 h-2 w-2 rounded-full bg-brand-200" />
      <div aria-hidden className="pointer-events-none absolute right-[14%] top-56 h-3 w-3 rounded-full bg-brand-100" />
      <div aria-hidden className="pointer-events-none absolute left-[22%] bottom-48 h-2.5 w-2.5 rounded-full bg-brand-100" />
      <div aria-hidden className="pointer-events-none absolute right-[24%] bottom-64 text-brand-200">
        <Sparkles className="h-5 w-5" />
      </div>

      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-16">
        {/* 로고 */}
        <Image
          src="/trace-logo-horizontal-v1.png"
          alt="TRACE"
          width={2073}
          height={758}
          priority
          className="h-auto w-44"
        />

        {/* 히어로 펀치라인 */}
        <h1 className="mt-10 text-center text-[2.1rem] font-bold leading-snug tracking-tight text-foreground sm:text-[2.6rem]">
          분석에서 끝나지 않고,
          <br />
          <span className="text-brand-600">다음 배움으로.</span>
        </h1>
        <p className="mt-4 text-center text-base leading-relaxed text-muted sm:text-lg">
          배움의 흔적을 연결하면 다음 배움이 보입니다.
        </p>

        {/* 로그인 카드 */}
        <div className="mt-10 w-full max-w-md rounded-3xl border border-line/70 bg-white p-8 shadow-[0_2px_6px_rgb(15_23_42/0.03),0_16px_40px_rgb(29_107_243/0.08)]">
          <GoogleLoginButton />
          <p className="mt-4 text-center text-xs leading-relaxed text-muted">
            별도 회원가입 없이 첫 로그인이 곧 가입이에요.
          </p>

          {errorMessage && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-center text-sm text-danger"
            >
              {errorMessage}
            </p>
          )}

          <div className="mt-6 flex items-center justify-center gap-1.5 rounded-xl bg-brand-50/60 px-4 py-2.5 text-xs font-medium text-brand-700">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            학생 이름과 번호는 AI로 전송되지 않습니다
          </div>
        </div>

        {/* 핵심 가치 3카드 — 프로토타입의 파스텔 아이콘 칩 스타일 */}
        <ul className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, iconClass, title, description }) => (
            <li
              key={title}
              className="rounded-2xl border border-line/60 bg-white/80 p-5 text-center backdrop-blur-sm"
            >
              <span
                className={`mx-auto flex h-11 w-11 items-center justify-center rounded-2xl ${iconClass}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-bold text-foreground">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-center text-xs leading-relaxed text-muted">
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
      </main>
      <Footer />
    </div>
  );
}
