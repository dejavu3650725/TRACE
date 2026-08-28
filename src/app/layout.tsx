import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TRACE",
    template: "%s | TRACE",
  },
  description:
    "학생의 학습결과를 입력받아 교육과정 기준으로 구조화·분석·누적하여 피드백과 성장 리포트로 연결하는 교사용 학습 성장 지원 시스템",
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
