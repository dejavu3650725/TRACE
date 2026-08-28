"use client";

import { ErrorState } from "@/components/ui/ErrorState";

/** Public error boundary: do not expose token or server error details. */
export default function StudentSubmitError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="제출 화면을 불러오지 못했어요"
      description="잠시 후 다시 시도해 주세요."
      onRetry={reset}
    />
  );
}
