import "server-only";

import {
  AI_ACTIVITY_DRAFT_JSON_SCHEMA,
  AiActivityDraftSchema,
  type AiActivityDraft,
} from "../../features/activities/ai-schema.ts";
import type { VlmAdapter } from "./contracts.ts";
import { VlmAdapterRequestError } from "./contracts.ts";
import {
  buildActivityDraftPrivacyContext,
  createPrivacySafeVlmRequest,
  type ActivityDraftPrivacyContext,
} from "./privacy-context.ts";

export type ActivityDraftGenerationInput = {
  teacherPrompt: string;
  metadata: {
    schoolLevel: "초등학교" | "고등학교";
    grade: number;
    subject: string | null;
    domain: string | null;
    unit: string | null;
    activityType: string | null;
  };
  candidateStandards: Array<{
    id: string;
    grade: string;
    subject: string;
    domain: string;
    description: string;
  }>;
};

function buildActivityPrompt(input: ActivityDraftPrivacyContext): string {
  return `당신은 대한민국 초등·고등 교사의 학습활동 설계를 보조합니다.

[절대 규칙]
1. 교사가 검토할 DRAFT만 생성하며 승인·활성화했다고 표현하지 마십시오.
2. 학생 성취를 판단하거나 강점·어려움·피드백·성취수준·AI Rubric을 만들지 마십시오.
3. 개인 식별정보를 만들거나 요구하지 마십시오.
4. standard_candidates에는 아래 후보의 id만 사용할 수 있습니다. 적절한 후보가 없으면 빈 배열로 두십시오.
5. question_id는 Q1부터 순서대로 부여하십시오.
6. 객관식이 아니면 options는 빈 배열로 두십시오.
7. 모든 문장은 교사가 바로 수정할 수 있는 명확한 한국어로 작성하십시오.

[교사 요청]
${input.teacherPrompt}

[구조화 메타데이터]
${JSON.stringify(input.metadata)}

[서버에서 좁힌 성취기준 후보 — 이 목록 밖의 코드를 만들지 말 것]
${JSON.stringify(input.candidateStandards)}

지정된 JSON 스키마만 반환하십시오.`;
}

function cleanJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as unknown;
}

function validateDraft(
  raw: string,
  input: ActivityDraftPrivacyContext,
  allowedStandardIds: Set<string>,
): AiActivityDraft {
  const draft = AiActivityDraftSchema.parse(cleanJson(raw));
  if (draft.grade !== input.metadata.grade) {
    throw new Error("AI returned a grade outside the selected school context");
  }
  if (input.metadata.schoolLevel === "고등학교" && draft.subject !== "정보") {
    throw new Error("AI returned a non-Information high-school subject");
  }
  if (input.metadata.subject !== null && draft.subject !== input.metadata.subject) {
    throw new Error("AI returned a subject outside the resolved Curriculum context");
  }
  if (!draft.standard_candidates.every((standardId) => allowedStandardIds.has(standardId))) {
    throw new Error("AI returned a Standard outside the narrowed candidate set");
  }
  return draft;
}

async function requestDraft(
  adapter: VlmAdapter,
  context: ActivityDraftPrivacyContext,
): Promise<string> {
  const result = await adapter.generate(createPrivacySafeVlmRequest({
    purpose: "ACTIVITY_DRAFT",
    prompt: buildActivityPrompt(context),
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseJsonSchema: AI_ACTIVITY_DRAFT_JSON_SCHEMA,
    },
  }));

  if (!result.ok) throw new VlmAdapterRequestError(result);
  return result.outputText;
}

/** Feature-specific prompt/validation over the shared provider-independent VLM adapter. */
export async function generateActivityDraftWithVlm(
  input: ActivityDraftGenerationInput,
  adapter: VlmAdapter,
): Promise<AiActivityDraft> {
  const context = buildActivityDraftPrivacyContext(input);
  const allowedStandardIds = new Set(context.candidateStandards.map((standard) => standard.id));
  let firstError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return validateDraft(await requestDraft(adapter, context), context, allowedStandardIds);
    } catch (error) {
      firstError ??= error;
      if (error instanceof VlmAdapterRequestError && !error.retryable) break;
    }
  }

  throw firstError instanceof Error ? firstError : new Error("AI Activity Draft generation failed");
}
