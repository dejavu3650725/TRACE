import { z } from "zod";

/**
 * PROCESS AI 분석 결과 스키마 (PRD §9.2 AI Output)
 * Gemini 응답은 반드시 이 스키마의 zod 검증을 통과해야 DB에 저장된다.
 * 반복 오류(Errors)는 독립 블록이 아니라 difficulties 내부 태그로 표현한다 (TRD §45).
 */

export const EvidenceItemSchema = z.object({
  /** 학생 결과물에서 실제로 관찰된 내용의 발췌/서술 */
  claim: z.string().min(1).max(500),
  /** 어느 문항에서 관찰됐는지 (StructuredInput의 question_id) */
  question_id: z.string().max(20).nullish(),
  /** 원본 몇 페이지(몇 번째 이미지)에서 관찰됐는지, 1부터 */
  source_page: z.number().int().min(1).nullish(),
});

export const DifficultyItemSchema = z.object({
  text: z.string().min(1).max(300),
  /** 반복적으로 나타나는 오류인가 (검토 화면에서 '반복 오류' 태그로 표시) */
  is_repeated_error: z.boolean().default(false),
});

export const AnalysisResultSchema = z.object({
  /** 반드시 제공된 성취수준 코드 중 하나 (예: "상" | "중" | "하") */
  achievement_level: z.string().min(1).max(10),
  strengths: z.array(z.string().min(1).max(300)).max(5).default([]),
  difficulties: z.array(DifficultyItemSchema).max(5).default([]),
  evidence: z.array(EvidenceItemSchema).min(1).max(10),
  /** 교사가 바로 수정해 쓸 수 있는 학생 피드백 초안 (존댓말, 2~3문장) */
  feedback_candidate: z.string().min(1).max(600),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
