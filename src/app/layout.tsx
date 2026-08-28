import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://trace-rho-sandy.vercel.app"),
  title: {
    default: "TRACE",
    template: "%s | TRACE",
  },
  description:
    "학생의 학습결과를 입력받아 교육과정 기준으로 구조화·분석·누적하여 피드백과 성장 리포트로 연결하는 교사용 학습 성장 지원 시스템",
  openGraph: {
    siteName: "TRACE",
    title: "TRACE — 분석에서 끝나지 않고, 다음 배움으로.",
    description: "배움의 흔적을 연결하면 다음 배움이 보입니다. 교사가 만든 AI 학습 성장 기록.",
    url: "/",
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "TRACE — 분석에서 끝나지 않고, 다음 배움으로.",
    description: "배움의 흔적을 연결하면 다음 배움이 보입니다. 교사가 만든 AI 학습 성장 기록.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
