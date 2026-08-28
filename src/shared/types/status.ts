/**
 * TRACE 공통 Status Enum 계약 (TRD §18)
 * ⚠️ 값을 임의로 추가/변경하지 않는다. 변경은 팀 합의 → Shared Contract 갱신 후.
 */

export const ACTIVITY_STATUS = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUS)[number];

export const ACTIVITY_ASSIGNMENT_STATUS = ["OPEN", "CLOSED", "ARCHIVED"] as const;
export type ActivityAssignmentStatus = (typeof ACTIVITY_ASSIGNMENT_STATUS)[number];

export const INPUT_STATUS = [
  "UPLOADING",
  "STORED",
  "PREPROCESSING",
  "STRUCTURING",
  "REVIEW_PENDING",
  "READY_FOR_PROCESS",
  "FAILED",
] as const;
export type InputStatus = (typeof INPUT_STATUS)[number];

export const PROCESS_STATUS = [
  "NOT_STARTED",
  "READY_TO_ANALYZE",
  "ANALYZING",
  "REVIEW_REQUIRED",
  "APPROVED",
  "FAILED",
] as const;
export type ProcessStatus = (typeof PROCESS_STATUS)[number];

export const ARTIFACT_ROLE = ["ORIGINAL", "PROCESSED", "DERIVED"] as const;
export type ArtifactRole = (typeof ARTIFACT_ROLE)[number];

export const ANALYSIS_STATUS = [
  "AI_DRAFT",
  "TEACHER_REVIEW",
  "APPROVED",
  "EDITED_APPROVED",
  "REJECTED",
  "FAILED",
] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUS)[number];

export const REVIEW_DECISION = ["APPROVED", "EDITED_APPROVED", "REJECTED"] as const;
export type ReviewDecision = (typeof REVIEW_DECISION)[number];

export const GROWTH_EVENT_STATUS = [
  "AI_DRAFT",
  "TEACHER_REVIEW",
  "APPROVED",
  "EDITED_APPROVED",
  "REJECTED",
] as const;
export type GrowthEventStatus = (typeof GROWTH_EVENT_STATUS)[number];

export const PROCESSING_JOB_STATUS = [
  "QUEUED",
  "PROCESSING",
  "REVIEW_REQUIRED",
  "COMPLETED",
  "FAILED",
] as const;
export type ProcessingJobStatus = (typeof PROCESSING_JOB_STATUS)[number];

export const ARTIFACT_SOURCE_TYPE = [
  "STUDENT_CAPTURE",
  "TEACHER_SCAN",
  "FILE_UPLOAD",
] as const;
export type ArtifactSourceType = (typeof ARTIFACT_SOURCE_TYPE)[number];

/* ─────────────────────────────────────────────
 * 공통 UI Status Mapping (TRD §48)
 * 기술 Enum 문자열을 사용자에게 그대로 노출하지 않는다.
 * ──────────────────────────────────────────── */

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger" | "brand";

export const INPUT_STATUS_LABEL: Record<InputStatus, { label: string; tone: StatusTone }> = {
  UPLOADING: { label: "업로드 중", tone: "info" },
  STORED: { label: "저장 완료", tone: "neutral" },
  PREPROCESSING: { label: "자료 정리 중", tone: "info" },
  STRUCTURING: { label: "내용을 확인하는 중", tone: "info" },
  REVIEW_PENDING: { label: "검토 대기", tone: "warning" },
  READY_FOR_PROCESS: { label: "분석 준비", tone: "brand" },
  FAILED: { label: "처리 실패", tone: "danger" },
};

export const PROCESS_STATUS_LABEL: Record<ProcessStatus, { label: string; tone: StatusTone }> = {
  NOT_STARTED: { label: "미분석", tone: "neutral" },
  READY_TO_ANALYZE: { label: "분석 대기", tone: "neutral" },
  ANALYZING: { label: "AI 분석 중", tone: "info" },
  REVIEW_REQUIRED: { label: "분석 검토 필요", tone: "warning" },
  APPROVED: { label: "승인 완료", tone: "success" },
  FAILED: { label: "분석 실패", tone: "danger" },
};

export const ANALYSIS_STATUS_LABEL: Record<AnalysisStatus, { label: string; tone: StatusTone }> = {
  AI_DRAFT: { label: "AI 초안", tone: "info" },
  TEACHER_REVIEW: { label: "검토 중", tone: "warning" },
  APPROVED: { label: "승인 완료", tone: "success" },
  EDITED_APPROVED: { label: "수정 후 승인", tone: "success" },
  REJECTED: { label: "반려", tone: "danger" },
  FAILED: { label: "분석 실패", tone: "danger" },
};

/** AI 신뢰도 4등급 (TrustBadge) */
export const TRUST_LEVELS = ["HIGH", "MEDIUM", "LOW", "UNCERTAIN"] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

export const TRUST_LEVEL_LABEL: Record<TrustLevel, { label: string; tone: StatusTone }> = {
  HIGH: { label: "신뢰도 높음", tone: "success" },
  MEDIUM: { label: "신뢰도 보통", tone: "info" },
  LOW: { label: "신뢰도 낮음", tone: "warning" },
  UNCERTAIN: { label: "확인 필요", tone: "danger" },
};
