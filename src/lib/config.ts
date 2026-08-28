/**
 * TRACE 공통 Config 상수 (TRD §7.5, §30.7)
 * 코드 곳곳에 하드코딩하지 않고 반드시 여기서 import 한다.
 */

export const FILE_LIMITS = {
  IMAGE_MAX_BYTES: 10 * 1024 * 1024, // 10 MB
  PDF_MAX_BYTES: 30 * 1024 * 1024, // 30 MB
  PDF_MAX_PAGES: 100,
  SPREADSHEET_MAX_BYTES: 10 * 1024 * 1024, // 10 MB (CSV/XLSX)
  BATCH_IMAGES_MAX_FILES: 100,
} as const;

export const CLASS_CODE = {
  /** Class Code 유효기간 (TRD §30.7 기본값 24시간) */
  VALIDITY_HOURS: 24,
  LENGTH: 6,
} as const;

export const RATE_LIMIT = {
  /** 학생 제출 검증: 동일 IP+token 기준 5분 내 실패 10회 초과 → 10분 제한 */
  VERIFY_WINDOW_MINUTES: 5,
  VERIFY_MAX_FAILURES: 10,
  VERIFY_BLOCK_MINUTES: 10,
} as const;

export const STORAGE = {
  BUCKET: "trace",
  /** Storage Key는 UUID 기반. 학생 이름/번호/원본 파일명 포함 금지 (TRD §30.9) */
  submissionOriginalPath: (teacherId: string, submissionId: string, artifactUuid: string, ext: string) =>
    `teachers/${teacherId}/submissions/${submissionId}/original/${artifactUuid}.${ext}`,
  submissionProcessedPath: (teacherId: string, submissionId: string, artifactUuid: string, ext: string) =>
    `teachers/${teacherId}/submissions/${submissionId}/processed/${artifactUuid}.${ext}`,
  activitySourcePath: (teacherId: string, activityId: string, artifactUuid: string, ext: string) =>
    `teachers/${teacherId}/activities/${activityId}/source/${artifactUuid}.${ext}`,
} as const;
