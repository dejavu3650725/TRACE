import { z } from "zod";

export const OBSERVABLE_RESPONSE_TYPES = [
  "short_text",
  "long_text",
  "selection",
  "checkbox",
  "matching",
  "underline",
  "circle",
  "drawing_or_mark",
  "blank",
  "unknown",
] as const;

const FORBIDDEN_JUDGMENT_KEYS = new Set([
  "correct",
  "correctness",
  "iscorrect",
  "score",
  "achievementlevel",
  "strength",
  "strengths",
  "difficulty",
  "difficulties",
  "evidence",
  "feedback",
  "growth",
  "studentid",
  "studentname",
  "studentnumber",
  "teacheremail",
]);

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findForbiddenKey(value: unknown, path = "response"): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenKey(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_JUDGMENT_KEYS.has(normalizedKey(key))) return `${path}.${key}`;
    const found = findForbiddenKey(nested, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

const ObservableResponseSchema = z.record(z.string(), z.json()).superRefine((response, context) => {
  if (Object.keys(response).length === 0) {
    context.addIssue({ code: "custom", message: "Observable response must not be empty" });
  }
  const forbiddenPath = findForbiddenKey(response);
  if (forbiddenPath) {
    context.addIssue({ code: "custom", message: `Judgment or identity field is prohibited at ${forbiddenPath}` });
  }
});

export const StructuredInputRuntimeSchema = z.object({
  schema_version: z.literal("1"),
  questions: z.array(z.object({
    question_id: z.string().trim().min(1).max(100),
    response_type: z.enum(OBSERVABLE_RESPONSE_TYPES),
    response: ObservableResponseSchema,
  }).strict()).min(1).max(200),
}).strict().superRefine((input, context) => {
  const questionIds = input.questions.map((question) => question.question_id);
  if (new Set(questionIds).size !== questionIds.length) {
    context.addIssue({ code: "custom", path: ["questions"], message: "Question IDs must be unique" });
  }
});

export type StructuredInputRuntime = z.infer<typeof StructuredInputRuntimeSchema>;
