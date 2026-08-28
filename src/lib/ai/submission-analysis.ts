import "server-only";

import { AnalysisResultSchema, type AnalysisResult } from "@/features/process/schema";
import type { Standard } from "@/lib/curriculum/loader";
import type { StructuredInput } from "@/shared/types/db";
import type { VlmAdapter } from "./contracts.ts";
import { VlmAdapterRequestError } from "./contracts.ts";
import {
  buildSubmissionAnalysisPrivacyContext,
  createPrivacySafeVlmRequest,
  type SubmissionAnalysisPrivacyContext,
} from "./privacy-context.ts";

export interface AnalyzeInput {
  structuredInput: StructuredInput | null;
  images: Array<{ mimeType: string; base64: string }>;
  activity: { title: string; description?: string | null };
  standards: Standard[];
  previousApprovedEvidence?: string[];
}

function buildPrompt(input: SubmissionAnalysisPrivacyContext): string {
  const levelCodes = input.standards[0]?.achievement_levels.map((level) => level.level)
    ?? ["상", "중", "하"];
  const standardsBlock = input.standards.length
    ? input.standards
        .map(
          (standard) =>
            `- [${standard.standard_id}] ${standard.text}\n`
            + standard.achievement_levels
              .map((level) => `  · ${level.level}: ${level.description}`)
              .join("\n"),
        )
        .join("\n")
    : "- (성취기준 미지정: 활동 내용에 근거해 일반적 학습 수준으로 판단하되, 과도한 단정을 피할 것)";
  const structuredBlock = input.structuredInput
    ? JSON.stringify(input.structuredInput, null, 2)
    : "(구조화된 응답 없음 — 첨부 이미지에서 직접 관찰할 것)";
  const previousBlock = input.previousApprovedEvidence?.length
    ? `\n[이전에 교사가 승인한 학습 근거]\n${input.previousApprovedEvidence.map((evidence) => `- ${evidence}`).join("\n")}`
    : "";

  return `당신은 초·중등 교사의 평가를 보조하는 분석가입니다. 학습 결과물을 성취기준과 성취수준에 근거해 분석합니다.

[절대 규칙]
1. 관찰되지 않은 사실을 만들어내지 마십시오. 모든 판단은 응답·이미지에서 실제로 관찰한 내용에 근거해야 합니다.
2. 이름·번호 등 신원 정보를 생성하거나 언급하지 말고, 학습자를 "학생"으로만 지칭합니다.
3. 낙인 표현이 아니라 관찰 서술로 씁니다.
4. achievement_level 값은 반드시 다음 중 하나여야 합니다: ${levelCodes.join(", ")}
5. 반드시 아래 JSON 스키마 형식으로만 응답하십시오. JSON 외의 텍스트를 포함하지 마십시오.

[활동 정보]
제목: ${input.activity.title}
${input.activity.description ? `설명: ${input.activity.description}` : ""}

[성취기준과 성취수준]
${standardsBlock}

[관찰 가능한 응답 (StructuredInput)]
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

function parseResult(raw: string): AnalysisResult {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return AnalysisResultSchema.parse(JSON.parse(cleaned) as unknown);
}

/** Submission analysis over the same privacy-gated provider-independent adapter. */
export async function analyzeSubmissionWithVlm(
  input: AnalyzeInput,
  adapter: VlmAdapter,
): Promise<AnalysisResult> {
  const context = buildSubmissionAnalysisPrivacyContext(input);
  const request = createPrivacySafeVlmRequest({
    purpose: "SUBMISSION_ANALYSIS",
    prompt: buildPrompt(context),
    media: context.images.map((image) => ({ mimeType: image.mimeType, base64: image.base64 })),
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });
  let firstError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await adapter.generate(request);
    if (!result.ok) {
      const error = new VlmAdapterRequestError(result);
      firstError ??= error;
      if (!error.retryable) break;
      continue;
    }
    try {
      return parseResult(result.outputText);
    } catch (error) {
      firstError ??= error;
    }
  }

  throw firstError instanceof Error ? firstError : new Error("AI analysis failed");
}
