import type { Metadata } from "next";

export const metadata: Metadata = { title: "과제 제출" };

/**
 * 학생 제출 /submit/[token] (TRD §42.1) — Student Submit Layout
 * Teacher App Shell을 사용하지 않는다. 모바일 우선.
 * Flow: Activity 안내 → Class Code(6칸) → 번호+이름 → 검증 → AutoCapture/파일 → 미리보기 → 제출
 * 학생 브라우저는 Teacher Data Access를 받지 않는다. /api/submit/* 서버 검증만 사용 (TRD §30.4).
 * Owner: INPUT (feat/input)
 */
export default async function SubmitPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await params; // token은 서버 검증에서만 사용

  return (
    <div>
      <h1 className="text-lg font-bold text-foreground">과제 제출하기</h1>
      <p className="mt-1 text-sm text-muted">
        선생님이 알려준 학급 코드를 입력해 주세요.
      </p>

      {/* 학급 코드 6칸 — TODO(INPUT): StudentVerificationForm 구현 */}
      <div className="mt-6 flex justify-between gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex h-14 flex-1 items-center justify-center rounded-xl border-2 border-line bg-background text-xl font-bold text-muted"
          >
            ·
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled
        className="mt-6 w-full rounded-xl bg-brand-600 px-4 py-3.5 text-sm font-semibold text-white opacity-50"
      >
        다음
      </button>

      <p className="mt-4 text-center text-xs text-muted">
        제출 기능은 준비 중이에요. (INPUT 모듈 구현)
      </p>
    </div>
  );
}
