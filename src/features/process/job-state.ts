export type ProcessingJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "REVIEW_REQUIRED"
  | "COMPLETED"
  | "FAILED";

export function isProcessingJobActive(status: ProcessingJobStatus): boolean {
  return status === "QUEUED" || status === "PROCESSING";
}

export function isProcessingJobTerminal(status: ProcessingJobStatus): boolean {
  return !isProcessingJobActive(status);
}

export function analysisJobFinalStatus(
  completedCount: number,
  failedCount: number,
): ProcessingJobStatus {
  return completedCount === 0 && failedCount > 0 ? "FAILED" : "REVIEW_REQUIRED";
}

/** Persistent Job errors stay generic so prompts, responses, URLs, and PII are never copied. */
export function safeProcessingJobErrorMessage(failedCount: number): string | null {
  return failedCount > 0 ? "일부 자료 분석에 실패했습니다." : null;
}
