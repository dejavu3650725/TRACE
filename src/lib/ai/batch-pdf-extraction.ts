import "server-only";

import { z } from "zod";
import type { BatchExtractedGroup } from "../../features/artifacts/batch-matching.ts";
import {
  OBSERVABLE_RESPONSE_TYPES,
  StructuredInputRuntimeSchema,
} from "../../features/submissions/structured-input-schema.ts";
import type { VlmAdapter } from "./contracts.ts";
import { VlmAdapterRequestError } from "./contracts.ts";
import {
  buildBatchPdfExtractionPrivacyContext,
  createPrivacySafeVlmRequest,
  type BatchPdfExtractionPrivacyContext,
} from "./privacy-context.ts";

const ProviderQuestionSchema = z.object({
  question_id: z.string().trim().min(1).max(100),
  visible_prompt: z.string().trim().max(2_000).nullable(),
  response_type: z.enum(OBSERVABLE_RESPONSE_TYPES),
  raw_text: z.string().max(10_000).nullable(),
  selected_options: z.array(z.string().max(1_000)).max(50),
  marks: z.array(z.string().max(1_000)).max(50),
  drawing_description: z.string().max(5_000).nullable(),
  is_blank: z.boolean(),
  uncertain: z.boolean(),
}).strict();

const ProviderGroupSchema = z.object({
  range_index: z.number().int().min(0).max(99),
  visible_grade: z.string().trim().max(50).nullable(),
  visible_class: z.string().trim().max(100).nullable(),
  visible_number: z.string().trim().max(50).nullable(),
  visible_name: z.string().trim().max(100).nullable(),
  identity_uncertain: z.boolean(),
  questions: z.array(ProviderQuestionSchema).min(1).max(200),
}).strict();

const ProviderBatchSchema = z.object({
  groups: z.array(ProviderGroupSchema).min(1).max(100),
}).strict();

export const BATCH_PDF_EXTRACTION_JSON_SCHEMA = {
  type: "object",
  required: ["groups"],
  properties: {
    groups: {
      type: "array",
      items: {
        type: "object",
        required: [
          "range_index", "visible_grade", "visible_class", "visible_number",
          "visible_name", "identity_uncertain", "questions",
        ],
        properties: {
          range_index: { type: "integer" },
          visible_grade: { type: ["string", "null"] },
          visible_class: { type: ["string", "null"] },
          visible_number: { type: ["string", "null"] },
          visible_name: { type: ["string", "null"] },
          identity_uncertain: { type: "boolean" },
          questions: {
            type: "array",
            items: {
              type: "object",
              required: [
                "question_id", "visible_prompt", "response_type", "raw_text",
                "selected_options", "marks", "drawing_description", "is_blank", "uncertain",
              ],
              properties: {
                question_id: { type: "string" },
                visible_prompt: { type: ["string", "null"] },
                response_type: { type: "string" },
                raw_text: { type: ["string", "null"] },
                selected_options: { type: "array", items: { type: "string" } },
                marks: { type: "array", items: { type: "string" } },
                drawing_description: { type: ["string", "null"] },
                is_blank: { type: "boolean" },
                uncertain: { type: "boolean" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export type BatchPdfExtractionInput = {
  activity: BatchPdfExtractionPrivacyContext["activity"];
  pageRanges: BatchPdfExtractionPrivacyContext["pageRanges"];
  pdfBase64: string;
};

function buildPrompt(context: BatchPdfExtractionPrivacyContext): string {
  return `이 PDF는 합성 학생 데이터로 만든 교사용 일괄 활동지 시연 자료입니다.

[작업]
제공된 각 페이지를 서로 독립적으로 확인하세요. 각 페이지 상단에 실제로 보이는 학년, 반, 번호, 이름을 그 페이지에서 다시 읽어 그대로 옮기고, 문항과 작성된 답안/선택/표시를 관찰 가능한 형태로 추출하세요.

[절대 규칙]
1. 페이지 순서나 번호 순서를 신원으로 추정하지 마세요.
2. 보이지 않거나 읽을 수 없는 값은 null로 두고 identity_uncertain=true로 표시하세요.
3. 답의 정오, 점수, 성취수준, 강점, 어려움, Evidence, 피드백, 성장 판단을 만들지 마세요.
4. 빈 답은 is_blank=true로 표시하고 내용을 만들어내지 마세요.
5. range_index는 제공된 값 그대로 사용하고 모든 구간을 한 번씩 반환하세요.
6. 알려진 문항 구조가 있으면 question_id와 response type을 우선 사용하되, PDF에 실제 보이는 문항·응답만 반환하세요.
7. 앞 페이지의 작성자 표기를 다음 페이지에 복사하지 마세요. 현재 페이지에 보이는 표기만 기록하세요.

[활동]
${JSON.stringify(context.activity)}

[페이지 구간 - PDF 절대 페이지 번호]
${JSON.stringify(context.pageRanges)}

[출력 JSON 구조]
{
  "groups": [{
    "range_index": 0,
    "visible_grade": "문서에 보이는 값 또는 null",
    "visible_class": "문서에 보이는 값 또는 null",
    "visible_number": "문서에 보이는 값 또는 null",
    "visible_name": "문서에 보이는 값 또는 null",
    "identity_uncertain": false,
    "questions": [{
      "question_id": "Q1",
      "visible_prompt": "문서에 보이는 문항 또는 null",
      "response_type": "short_text | long_text | selection | checkbox | matching | underline | circle | drawing_or_mark | blank | unknown",
      "raw_text": "보이는 작성문 또는 null",
      "selected_options": [],
      "marks": [],
      "drawing_description": null,
      "is_blank": false,
      "uncertain": false
    }]
  }]
}

JSON 객체 하나만 반환하세요.`;
}

function cleanJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace < 0) throw new Error("Batch extraction JSON object was not found");
  let depth = 0;
  let insideString = false;
  let escaped = false;
  for (let index = firstBrace; index < cleaned.length; index += 1) {
    const character = cleaned[index];
    if (insideString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') insideString = false;
      continue;
    }
    if (character === '"') insideString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(cleaned.slice(firstBrace, index + 1)) as unknown;
    }
  }
  throw new Error("Batch extraction JSON object was incomplete");
}

function compactResponse(question: z.infer<typeof ProviderQuestionSchema>) {
  if (question.is_blank) return { is_blank: true };
  const response: Record<string, string | string[] | boolean> = { is_blank: false };
  if (question.raw_text !== null && question.raw_text.trim()) response.raw_text = question.raw_text.trim();
  if (question.selected_options.length > 0) response.selected_options = question.selected_options;
  if (question.marks.length > 0) response.marks = question.marks;
  if (question.drawing_description !== null && question.drawing_description.trim()) {
    response.drawing_description = question.drawing_description.trim();
  }
  if (question.uncertain) response.uncertain = true;
  return response;
}

function normalizeProviderOutput(
  raw: string,
  pageRanges: BatchPdfExtractionPrivacyContext["pageRanges"],
): BatchExtractedGroup[] {
  const parsed = ProviderBatchSchema.parse(cleanJson(raw));
  const expectedIndexes = new Set(pageRanges.map((range) => range.rangeIndex));
  if (
    parsed.groups.length !== pageRanges.length
    || new Set(parsed.groups.map((group) => group.range_index)).size !== parsed.groups.length
    || parsed.groups.some((group) => !expectedIndexes.has(group.range_index))
  ) {
    throw new Error("Batch extraction ranges did not match the requested ranges");
  }

  return parsed.groups.map((group) => {
    const structuredInput = StructuredInputRuntimeSchema.parse({
      schema_version: "1",
      questions: group.questions.map((question) => ({
        question_id: question.question_id,
        response_type: question.response_type,
        response: compactResponse(question),
      })),
    });
    return {
      rangeIndex: group.range_index,
      identity: {
        grade: group.visible_grade,
        className: group.visible_class,
        studentNumber: group.visible_number,
        studentName: group.visible_name,
        uncertain: group.identity_uncertain,
      },
      questions: group.questions.map((question, index) => ({
        questionId: structuredInput.questions[index].question_id,
        visiblePrompt: question.visible_prompt,
        responseType: structuredInput.questions[index].response_type,
        response: structuredInput.questions[index].response,
        uncertain: question.uncertain,
      })),
    };
  });
}

/** One real Provider request for the prepared synthetic Batch PDF; roster data is never an input. */
export async function extractBatchPdfWithVlm(
  input: BatchPdfExtractionInput,
  adapter: VlmAdapter,
): Promise<BatchExtractedGroup[]> {
  const context = buildBatchPdfExtractionPrivacyContext({
    activity: input.activity,
    pageRanges: input.pageRanges,
    pdf: { mimeType: "application/pdf", base64: input.pdfBase64 },
  });
  const request = createPrivacySafeVlmRequest({
    purpose: "BATCH_PDF_EXTRACTION",
    prompt: buildPrompt(context),
    media: [{ mimeType: context.pdf.mimeType, base64: context.pdf.base64 }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 8_192,
      responseMimeType: "application/json",
      responseJsonSchema: BATCH_PDF_EXTRACTION_JSON_SCHEMA,
    },
    timeoutMs: 120_000,
  });
  let firstError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await adapter.generate(request);
    if (!result.ok) {
      const error = new VlmAdapterRequestError(result);
      firstError ??= error;
      if (!error.retryable) break;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1_500));
      continue;
    }
    try {
      return normalizeProviderOutput(result.outputText, context.pageRanges);
    } catch (error) {
      firstError ??= error;
    }
  }

  throw firstError instanceof Error ? firstError : new Error("Batch PDF extraction failed");
}
