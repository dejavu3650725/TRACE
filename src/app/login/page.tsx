import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { Footer } from "@/components/shell/Footer";
import { TraceWordmark } from "@/components/shell/TraceWordmark";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";

export const metadata: Metadata = { title: "로그인" };

/**
 * 로그인 /login (TRD §9)
 * 진입점은 [Google로 계속하기] 하나. 회원가입/로그인을 나누지 않는다.
 * 디자인: 라이트 그라운드 위 메시 그라데이션 + 그라데이션 헤드라인 —
 * 프로토타입의 펀치라인 문법("핵심 구절만 강조")을 유지한다.
 */

const FEATURES = [
  {
    icon: ScanLine,
    chip: "from-brand-50 to-brand-100 text-brand-600",
    title: "넣기만 하면 정리돼요",
    description: "촬영·업로드한 자료가 학생별로 연결됩니다",
  },
  {
    icon: Sparkles,
    chip: "from-violet-50 to-violet-100 text-violet-500",
    title: "성취기준에 근거한 분석",
    description: "강점·어려움·근거를 담은 AI 초안을 받아보세요",
  },
  {
    icon: BadgeCheck,
    chip: "from-emerald-50 to-emerald-100 text-emerald-500",
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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f8faff]">
      {/* 메시 그라데이션 배경 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            "radial-gradient(52rem 34rem at 16% -6%, rgb(29 107 243 / 0.13), transparent 60%)",
            "radial-gradient(46rem 30rem at 86% 4%, rgb(124 92 255 / 0.12), transparent 62%)",
            "radial-gradient(40rem 28rem at 50% 108%, rgb(45 190 166 / 0.10), transparent 60%)",
          ].join(","),
        }}
      />
      <div aria-hidden className="pointer-events-none absolute left-[14%] top-44 h-2 w-2 rounded-full bg-brand-300/80" />
      <div aria-hidden className="pointer-events-none absolute right-[16%] top-64 h-3 w-3 rounded-full bg-violet-200" />
      <div aria-hidden className="pointer-events-none absolute left-[24%] bottom-52 h-2.5 w-2.5 rounded-full bg-brand-200" />
      <div aria-hidden className="pointer-events-none absolute right-[26%] bottom-72 text-brand-200">
        <Sparkles className="h-5 w-5" />
      </div>

      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-16">
        {/* 로고 */}
        <div className="animate-rise">
          <TraceWordmark href="/" size="lg" />
        </div>

        {/* 아이브로우 */}
        <p
          className="animate-rise mt-8 inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-white/70 px-4 py-1.5 text-xs font-semibold tracking-wide text-brand-700 backdrop-blur-sm"
          style={{ animationDelay: "0.08s" }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          교사가 만든 AI 학습 성장 기록
        </p>

        {/* 히어로 펀치라인 */}
        <h1
          className="animate-rise mt-5 text-center text-[2.2rem] font-bold leading-[1.22] tracking-tight text-foreground sm:text-[2.9rem]"
          style={{ animationDelay: "0.16s" }}
        >
          분석에서 끝나지 않고,
          <br />
          <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-violet-500 bg-clip-text text-transparent">
            다음 배움으로.
          </span>
        </h1>
        <p
          className="animate-rise mt-5 text-center text-base leading-relaxed text-muted sm:text-lg"
          style={{ animationDelay: "0.24s" }}
        >
          배움의 흔적을 연결하면 다음 배움이 보입니다.
        </p>

        {/* 로그인 카드 */}
        <div
          className="animate-rise mt-11 w-full max-w-md rounded-[1.6rem] bg-gradient-to-b from-white to-brand-50/40 p-px shadow-[0_2px_8px_rgb(16_27_48/0.04),0_24px_60px_-12px_rgb(29_107_243/0.18)]"
          style={{ animationDelay: "0.32s" }}
        >
          <div className="rounded-[calc(1.6rem-1px)] bg-white/95 p-8 backdrop-blur">
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

            <div className="mt-6 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-50 to-violet-50 px-4 py-2.5 text-xs font-semibold text-brand-700">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              학생 이름과 번호는 AI로 전송되지 않습니다
            </div>
          </div>
        </div>

        {/* 핵심 가치 3카드 — 입력 → 분석 → 승인의 순서 */}
        <ul className="mt-14 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, chip, title, description }, i) => (
            <li
              key={title}
              className="animate-rise group rounded-2xl border border-white/60 bg-white/70 p-6 text-center shadow-[0_1px_3px_rgb(16_27_48/0.04)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_12px_32px_-8px_rgb(29_107_243/0.18)]"
              style={{ animationDelay: `${0.42 + i * 0.08}s` }}
            >
              <span
                className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br transition-transform duration-300 group-hover:scale-110 ${chip}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-3.5 text-sm font-bold text-foreground">{title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{description}</p>
            </li>
          ))}
        </ul>

        <p
          className="animate-rise mt-11 text-center text-xs leading-relaxed text-muted"
          style={{ animationDelay: "0.7s" }}
        >
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
