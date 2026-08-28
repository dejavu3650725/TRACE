import type { Metadata } from "next";
import { TraceWordmark } from "@/components/shell/TraceWordmark";
import { TermsContent } from "@/components/shell/LegalContent";

export const metadata: Metadata = { title: "이용약관" };

/** 이용약관 공개 페이지 — OAuth 동의 화면 등록용 공개 URL */
export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <TraceWordmark href="/" />
      <h1 className="mt-8 text-2xl font-bold text-foreground">이용약관</h1>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <TermsContent />
      </div>
      <p className="mt-8 text-center text-xs text-muted">
        © 2026 서울특별시교육청. All rights reserved. · 정보관리책임자: PROCESS 101
      </p>
    </main>
  );
}
