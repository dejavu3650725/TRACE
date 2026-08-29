import "server-only";

import { z } from "zod";
import { AI_QUESTION_TYPES } from "../../features/activities/ai-schema.ts";
import type { VlmAdapter } from "./contracts.ts";
import { VlmAdapterRequestError } from "./contracts.ts";
import {
  buildMaterialClassificationPrivacyContext,
  createPrivacySafeVlmRequest,
} from "./privacy-context.ts";

const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable();

export const MaterialClassificationSchema = z.object({
  title_candidate: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5_000),
  instructions: z.string().trim().min(1).max(3_000),
  grade: z.number().int().min(1).max(12).nullable(),
  subject: nullableText(100),
  domain: nullableText(200),
  unit: nullableText(200),
  activity_type: nullableText(100),
  pages_per_student: z.number().int().min(1).max(100).optional().default(1),
  keywords: z.array(z.string().trim().min(1).max(100)).max(10),
  questions: z.array(z.object({
    question_id: z.string().regex(/^Q(?:[1-9]|1[0-9]|20)$/),
    prompt: z.string().trim().min(1).max(2_000),
    question_type: z.enum(AI_QUESTION_TYPES),
    options: z.array(z.string().trim().min(1).max(300)).max(8),
  }).strict()).min(1).max(20),
}).strict().superRefine((value, context) => {
  value.questions.forEach((question, index) => {
    if (question.question_id !== `Q${index + 1}`) {
      context.addIssue({ code: "custom", path: ["questions", index, "question_id"], message: "Question IDs must be sequential" });
    }
  });
});

export type MaterialClassification = z.infer<typeof MaterialClassificationSchema>;

export const MATERIAL_CLASSIFICATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title_candidate", "description", "instructions", "grade", "subject", "domain",
    "unit", "activity_type", "pages_per_student", "keywords", "questions",
  ],
  properties: {
    title_candidate: { type: "string" },
    description: { type: "string" },
    instructions: { type: "string" },
    grade: { type: ["integer", "null"] },
    subject: { type: ["string", "null"] },
    domain: { type: ["string", "null"] },
    unit: { type: ["string", "null"] },
    activity_type: { type: ["string", "null"] },
    pages_per_student: { type: "integer", minimum: 1, maximum: 100 },
    keywords: { type: "array", maxItems: 10, items: { type: "string" } },
    questions: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question_id", "prompt", "question_type", "options"],
        properties: {
          question_id: { type: "string" },
          prompt: { type: "string" },
          question_type: { type: "string", enum: AI_QUESTION_TYPES },
          options: { type: "array", maxItems: 8, items: { type: "string" } },
        },
      },
    },
  },
} as const;

function firstJsonObject(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  if (start < 0) throw new Error("Material classification JSON was not found");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < cleaned.length; index += 1) {
    const character = cleaned[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return JSON.parse(cleaned.slice(start, index + 1)) as unknown;
  }
  throw new Error("Material classification JSON was incomplete");
}

function prompt(classGrade: number | null): string {
  return `업로드된 기존 활동지 PDF에서 인쇄된 활동 정보와 문항 구조만 추출하세요.

[절대 규칙]
1. 개인 식별정보, 작성된 응답, 점수, 정오, 성취수준, 피드백은 출력하지 마세요.
2. 문서에 인쇄된 제목, 안내문, 학년, 교과, 영역, 단원, 활동 유형, 문항만 근거로 사용하세요.
3. 보이지 않는 메타데이터는 null로 두고 교육과정 성취기준 코드를 만들지 마세요.
4. question_id는 Q1부터 순서대로 부여하세요.
5. 고등학교 자료라면 교과는 정보만 허용됩니다.
6. 참고 학년은 ${classGrade ?? "미지정"}이며, 문서에 명확한 학년이 있을 때만 grade에 기록하세요.
7. 같은 활동지가 작성자별로 연속 반복되는 PDF라면, 인쇄된 쪽 번호(예: 1/4~4/4), 활동 순서와 작성자 표기의 반복을 근거로 한 작성자에 해당하는 연속 페이지 수를 pages_per_student에 기록하세요. 작성자 식별정보 자체는 출력하지 마세요.
8. 동일한 활동지가 작성자별로 반복되어도 공통 문항은 한 번만 추출하세요.

[출력 JSON]
{
  "title_candidate": "활동 제목",
  "description": "문서 내용 요약",
  "instructions": "인쇄된 안내문",
  "grade": 3,
  "subject": "수학",
  "domain": "수와 연산",
  "unit": "분수",
  "activity_type": "활동지",
  "pages_per_student": 4,
  "keywords": ["분수", "크기 비교"],
  "questions": [{"question_id":"Q1","prompt":"인쇄된 문항","question_type":"SHORT_TEXT","options":[]}]
}

JSON 객체 하나만 반환하세요.`;
}

export async function classifyMaterialPdfWithVlm(input: {
  classGrade: number | null;
  pdfBase64: string;
}, adapter: VlmAdapter): Promise<MaterialClassification> {
  const context = buildMaterialClassificationPrivacyContext({
    classContext: { grade: input.classGrade },
    pdf: { mimeType: "application/pdf", base64: input.pdfBase64 },
  });
  const request = createPrivacySafeVlmRequest({
    purpose: "MATERIAL_CLASSIFICATION",
    prompt: prompt(context.classContext.grade),
    media: [{ mimeType: context.pdf.mimeType, base64: context.pdf.base64 }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 6_000,
      responseMimeType: "application/json",
      responseJsonSchema: MATERIAL_CLASSIFICATION_JSON_SCHEMA,
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
      continue;
    }
    try {
      return MaterialClassificationSchema.parse(firstJsonObject(result.outputText));
    } catch (error) {
      firstError ??= error;
    }
  }
  throw firstError instanceof Error ? firstError : new Error("Material classification failed");
}
