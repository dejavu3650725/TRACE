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

export type ActivityDraftPrivacyContext = z.infer<typeof activityDraftSourceSchema>;
export type SubmissionAnalysisPrivacyContext = z.infer<typeof analysisSourceSchema>;

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
