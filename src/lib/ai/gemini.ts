import "server-only";

import { AnalysisResultSchema, type AnalysisResult } from "@/features/process/schema";
import type { Standard } from "@/lib/curriculum/loader";
import type { StructuredInput } from "@/shared/types/db";
import { getGeminiApiKey } from "./provider";

/**
 * Gemini VLM Adapter (TRD §30.11~12)
 * - 반드시 서버에서만 실행된다 (server-only).
 * - AI Context에 학생 이름/번호, 교사 이메일을 절대 넣지 않는다.
 *   학생은 항상 "학생"이라는 가명으로만 지칭한다.
 * - 응답은 zod 검증을 통과해야 하며, 실패 시 1회만 재시도한다.
 */

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
}

export interface AnalyzeInput {
  /** 관찰 가능한 학생 응답 (PII 없음) */
  structuredInput: StructuredInput | null;
  /** 원본 이미지 (base64 + mime). 없으면 텍스트 응답만으로 분석 */
  images: Array<{ mimeType: string; base64: string }>;
  /** 활동 정보 (제목/설명 — 학생 정보 아님) */
  activity: { title: string; description?: string | null };
  /** Shared Curriculum에서 조회한 성취기준 + 성취수준 */
  standards: Standard[];
  /** 이전 승인 Evidence (선택, 누적 분석 맥락) */
  previousApprovedEvidence?: string[];
}

function buildPrompt(input: AnalyzeInput): string {
  const levelCodes = input.standards[0]?.achievement_levels.map((l) => l.level) ?? ["상", "중", "하"];

  const standardsBlock = input.standards.length
    ? input.standards
        .map(
          (s) =>
            `- [${s.standard_id}] ${s.text}\n` +
            s.achievement_levels.map((l) => `  · ${l.level}: ${l.description}`).join("\n"),
        )
        .join("\n")
    : "- (성취기준 미지정: 활동 내용에 근거해 일반적 학습 수준으로 판단하되, 과도한 단정을 피할 것)";

  const structuredBlock = input.structuredInput
    ? JSON.stringify(input.structuredInput, null, 2)
    : "(구조화된 응답 없음 — 첨부 이미지에서 직접 관찰할 것)";

  const previousBlock = input.previousApprovedEvidence?.length
    ? `\n[이전에 교사가 승인한 이 학생의 학습 근거]\n${input.previousApprovedEvidence.map((e) => `- ${e}`).join("\n")}`
    : "";

  return `당신은 초·중등 교사의 평가를 보조하는 분석가입니다. 학생의 학습 결과물을 성취기준과 성취수준에 근거해 분석합니다.

[절대 규칙]
1. 관찰되지 않은 사실을 만들어내지 마십시오. 모든 판단은 학생 응답·이미지에서 실제로 관찰한 내용에 근거해야 합니다.
2. 학생의 이름·번호 등 신원 정보를 생성하거나 언급하지 마십시오. 학생은 "학생"으로만 지칭합니다.
3. 낙인 표현("~가 부족한 학생이다")이 아니라 관찰 서술("~하는 모습이 관찰됨")로 씁니다.
4. achievement_level 값은 반드시 다음 중 하나여야 합니다: ${levelCodes.join(", ")}
5. 반드시 아래 JSON 스키마 형식으로만 응답하십시오. JSON 외의 텍스트를 포함하지 마십시오.

[활동 정보]
제목: ${input.activity.title}
${input.activity.description ? `설명: ${input.activity.description}` : ""}

[성취기준과 성취수준]
${standardsBlock}

[학생의 관찰 가능한 응답 (StructuredInput)]
${structuredBlock}
${previousBlock}

[출력 JSON 스키마]
{
  "achievement_level": "${levelCodes.join(" | ")} 중 하나",
  "strengths": ["강점 서술 (최대 5개)"],
  "difficulties": [{ "text": "어려움/보완점 서술", "is_repeated_error": false }],
  "evidence": [{ "claim": "실제 관찰된 내용의 발췌 또는 서술", "question_id": "Q1 (해당 시)", "source_page": 1 }],
  "feedback_candidate": "학생에게 전달할 피드백 초안 (존댓말 2~3문장)"
}`;
}

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

async function callGemini(parts: GeminiPart[], withThinkingOff = true): Promise<string> {
  const model = getGeminiModel();

  const generationConfig: Record<string, unknown> = {
    temperature: 0.2,
    responseMimeType: "application/json",
  };
  // 모델의 내부 '생각' 시간을 꺼서 응답 속도를 크게 줄인다.
  // (구조화 분석 작업이라 품질 영향 적음. 미지원 모델이면 아래에서 자동 폴백)
  if (withThinkingOff) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  // API Key는 URL이 아니라 헤더로 전달한다 (신형 키 형식 호환 + URL 로그 노출 방지)
  const res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": getGeminiApiKey(),
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // thinkingConfig 미지원 모델이면 해당 옵션 없이 1회 폴백
    if (res.status === 400 && withThinkingOff && /thinking/i.test(body)) {
      return callGemini(parts, false);
    }
    // API Key 등 민감정보가 로그에 남지 않도록 상태코드 중심으로 기록
    throw new Error(`Gemini API 오류 (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini 응답이 비어 있습니다.");
  return text;
}

function parseResult(raw: string): AnalysisResult {
  // 모델이 코드펜스로 감싸는 경우 대비
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed: unknown = JSON.parse(cleaned);
  return AnalysisResultSchema.parse(parsed);
}

/**
 * 학생 결과물 1건 분석. 파싱/검증 실패 시 1회만 재시도한다 (무한 루프 금지).
 */
export async function analyzeSubmissionWithGemini(input: AnalyzeInput): Promise<AnalysisResult> {
  const parts: GeminiPart[] = [{ text: buildPrompt(input) }];
  for (const img of input.images) {
    parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
  }

  try {
    return parseResult(await callGemini(parts));
  } catch (firstError) {
    // 재시도 1회 (스키마 미준수 응답 등)
    try {
      return parseResult(await callGemini(parts));
    } catch {
      throw firstError instanceof Error ? firstError : new Error("AI 분석 실패");
    }
  }
}
