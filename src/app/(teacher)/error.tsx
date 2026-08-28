"use client";

import { ErrorState } from "@/components/ui/ErrorState";

/** Shared teacher route error boundary. Never render server error details to the teacher. */
export default function TeacherRouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="화면을 불러오지 못했어요"
      description="잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 알려 주세요."
      onRetry={reset}
    />
  );
}
