import "server-only";

import { z } from "zod";
import type { VlmGenerationConfig, VlmMediaPart, VlmPurpose } from "./contracts.ts";
import { containsProhibitedAiContext, isProhibitedAiKey } from "./privacy-guard.ts";

const text = (max: number) => z.string().trim().min(1).max(max);

const activityDraftSourceSchema = z.object({
  teacherPrompt: text(2_000),
  metadata: z.object({
    schoolLevel: z.enum(["초등학교", "고등학교"]),
    grade: z.number().int().min(1).max(12),
    subject: z.string().trim().max(100).nullable(),
    domain: z.string().trim().max(200).nullable(),
    unit: z.string().trim().max(200).nullable(),
    activityType: z.string().trim().max(100).nullable(),
  }),
  candidateStandards: z.array(z.object({
    id: text(100),
    grade: text(100),
    subject: text(100),
    domain: text(200),
    description: text(4_000),
  })).max(100),
});

const structuredInputSchema = z.object({
  schema_version: text(20),
  questions: z.array(z.object({
    question_id: text(100),
    response_type: text(100),
    response: z.record(z.string(), z.unknown()),
  })).max(200),
});

const analysisSourceSchema = z.object({
  structuredInput: structuredInputSchema.nullable(),
  images: z.array(z.object({
    mimeType: text(100),
    base64: text(20_000_000),
  })).max(20),
  activity: z.object({
    title: text(500),
    description: z.string().trim().max(5_000).nullable().optional(),
  }),
  standards: z.array(z.object({
    standard_id: text(100),
    subject: text(100),
    grade_band: text(100),
    text: text(5_000),
    achievement_levels: z.array(z.object({
      level: text(100),
      description: text(5_000),
    })).max(20),
  })).max(100),
  previousApprovedEvidence: z.array(text(2_000)).max(50).optional(),
});

const batchPdfExtractionSourceSchema = z.object({
  activity: z.object({
    title: text(500),
    description: z.string().trim().max(5_000).nullable(),
    grade: z.number().int().min(1).max(12).nullable(),
    questions: z.array(z.object({
      questionId: text(100),
      prompt: text(2_000),
      responseType: z.string().trim().max(100).nullable(),
      options: z.array(text(500)).max(20),
    })).max(200),
  }),
  pageRanges: z.array(z.object({
    rangeIndex: z.number().int().min(0).max(99),
    pageStart: z.number().int().min(1).max(100),
    pageEnd: z.number().int().min(1).max(100),
  })).min(1).max(100),
  pdf: z.object({
    mimeType: z.literal("application/pdf"),
    base64: text(20_000_000),
  }),
});

const materialClassificationSourceSchema = z.object({
  classContext: z.object({
    grade: z.number().int().min(1).max(12).nullable(),
  }),
  pdf: z.object({
    mimeType: z.literal("application/pdf"),
    base64: text(20_000_000),
  }),
});

export type ActivityDraftPrivacyContext = z.infer<typeof activityDraftSourceSchema>;
export type SubmissionAnalysisPrivacyContext = z.infer<typeof analysisSourceSchema>;
export type BatchPdfExtractionPrivacyContext = z.infer<typeof batchPdfExtractionSourceSchema>;
export type MaterialClassificationPrivacyContext = z.infer<typeof materialClassificationSourceSchema>;

export class PrivacyContextViolationError extends Error {
  constructor(path: string) {
    super(`AI privacy boundary rejected context at ${path}`);
    this.name = "PrivacyContextViolationError";
  }
}

function assertPrivacySafe(value: unknown, path = "context"): void {
  if (typeof value === "string") {
    if (containsProhibitedAiContext(value)) throw new PrivacyContextViolationError(path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPrivacySafe(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    if (isProhibitedAiKey(key)) throw new PrivacyContextViolationError(`${path}.${key}`);
    assertPrivacySafe(nested, `${path}.${key}`);
  }
}

export function buildActivityDraftPrivacyContext(input: unknown): ActivityDraftPrivacyContext {
  const context = activityDraftSourceSchema.parse(input);
  assertPrivacySafe(context);
  return context;
}

export function buildSubmissionAnalysisPrivacyContext(
  input: unknown,
): SubmissionAnalysisPrivacyContext {
  const context = analysisSourceSchema.parse(input);
  const { images, ...textContext } = context;
  assertPrivacySafe(textContext);
  return { ...textContext, images };
}

/** The roster is intentionally not part of this allowlist. Visible identity exists only inside the synthetic PDF. */
export function buildBatchPdfExtractionPrivacyContext(
  input: unknown,
): BatchPdfExtractionPrivacyContext {
  const context = batchPdfExtractionSourceSchema.parse(input);
  const { pdf, ...textContext } = context;
  assertPrivacySafe(textContext);
  return { ...textContext, pdf };
}

/** No roster or identity field is accepted. The Provider sees only the owned PDF and non-PII Class grade. */
export function buildMaterialClassificationPrivacyContext(
  input: unknown,
): MaterialClassificationPrivacyContext {
  const context = materialClassificationSourceSchema.parse(input);
  const { pdf, ...textContext } = context;
  assertPrivacySafe(textContext);
  return { ...textContext, pdf };
}

const privacySafeRequestBrand = Symbol("trace.privacy-safe-vlm-request");

export type PrivacySafeVlmRequest = Readonly<{
  purpose: VlmPurpose;
  prompt: string;
  media: readonly VlmMediaPart[];
  generationConfig: VlmGenerationConfig;
  timeoutMs: number;
  [privacySafeRequestBrand]: true;
}>;

export function createPrivacySafeVlmRequest(input: {
  purpose: VlmPurpose;
  prompt: string;
  media?: readonly VlmMediaPart[];
  generationConfig?: VlmGenerationConfig;
  timeoutMs?: number;
}): PrivacySafeVlmRequest {
  const prompt = text(100_000).parse(input.prompt);
  assertPrivacySafe(prompt, "providerRequest.prompt");

  const media = z.array(z.object({
    mimeType: text(100),
    base64: text(20_000_000),
  })).max(20).parse(input.media ?? []);

  return Object.freeze({
    purpose: input.purpose,
    prompt,
    media,
    generationConfig: Object.freeze({ ...(input.generationConfig ?? {}) }),
    timeoutMs: z.number().int().min(1_000).max(120_000).parse(input.timeoutMs ?? 45_000),
    [privacySafeRequestBrand]: true as const,
  });
}

export function isPrivacySafeVlmRequest(value: unknown): value is PrivacySafeVlmRequest {
  return Boolean(
    value
      && typeof value === "object"
      && (value as Record<PropertyKey, unknown>)[privacySafeRequestBrand] === true,
  );
}
