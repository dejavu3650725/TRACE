import "server-only";

/**
 * AI/VLM Adapter 계약 (PRD §16 AI Layer, TRD §30.11)
 * - Provider가 바뀌어도 제품 코드를 크게 수정하지 않도록 Adapter 구조를 사용한다.
 * - 반드시 서버에서만 호출한다. 브라우저 → Provider 직접 호출 금지.
 * - AI Context에는 학생 이름/번호, 교사 이메일을 넣지 않는다 (TRD §30.12).
 */

export interface AIProvider {
  /** 원본 이미지/PDF에서 학년·교과·영역·성취기준 후보 추출 (INPUT Path B) */
  classifyActivity(input: ClassifyActivityInput): Promise<unknown>;
  /** StructuredInput + 원본 + Standard/AchievementLevel 기반 교육적 분석 (PROCESS) */
  analyzeSubmission(input: AnalyzeSubmissionInput): Promise<unknown>;
}

export interface ClassifyActivityInput {
  /** Signed URL 또는 base64 — 서버에서 생성한 짧은 만료 Signed URL만 사용 */
  artifactUrls: string[];
  candidateStandards: Array<{ standard_id: string; text: string }>;
}

export interface AnalyzeSubmissionInput {
  structuredInput: unknown;
  artifactUrls: string[];
  standards: Array<{
    standard_id: string;
    text: string;
    achievementLevels: Array<{ level: string; description: string }>;
  }>;
  previousApprovedEvidence?: Array<{ claim: string; created_at: string }>;
}

/**
 * Google AI Studio (Gemini) Adapter — 구현은 PROCESS 모듈에서 완성한다.
 * GEMINI_API_KEY는 서버 환경변수에서만 읽는다.
 */
export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았습니다. .env / Vercel 환경 변수를 확인하세요.",
    );
  }
  return key;
}
