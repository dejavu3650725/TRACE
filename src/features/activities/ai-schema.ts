import { z } from "zod";

export const AI_QUESTION_TYPES = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "MULTIPLE_CHOICE",
  "NUMBER",
  "DRAWING",
] as const;

export const AI_QUESTION_TYPE_LABEL: Record<(typeof AI_QUESTION_TYPES)[number], string> = {
  SHORT_TEXT: "단답형",
  LONG_TEXT: "서술형",
  MULTIPLE_CHOICE: "객관식",
  NUMBER: "숫자 응답",
  DRAWING: "그림·도식",
};

export const AiActivityQuestionSchema = z.object({
  question_id: z.string().regex(/^Q(?:[1-9]|1[0-9]|20)$/),
  prompt: z.string().trim().min(1).max(2000),
  question_type: z.enum(AI_QUESTION_TYPES),
  options: z.array(z.string().trim().min(1).max(300)).max(8),
});

export const AiActivityDraftSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(5000),
    instructions: z.string().trim().min(1).max(3000),
    grade: z.number().int().min(1).max(12).nullable(),
    subject: z.string().trim().min(1).max(100).nullable(),
    domain: z.string().trim().min(1).max(200).nullable(),
    unit: z.string().trim().min(1).max(200).nullable(),
    activity_type: z.string().trim().min(1).max(100).nullable(),
    standard_candidates: z.array(z.string().trim().min(1).max(100)).max(5),
    questions: z.array(AiActivityQuestionSchema).min(1).max(20),
    print_layout_data: z.object({
      paper_size: z.literal("A4"),
      orientation: z.enum(["PORTRAIT", "LANDSCAPE"]),
      estimated_pages: z.number().int().min(1).max(10),
    }),
  })
  .superRefine((draft, context) => {
    if (new Set(draft.standard_candidates).size !== draft.standard_candidates.length) {
      context.addIssue({ code: "custom", path: ["standard_candidates"], message: "Standard candidates must be unique" });
    }
    if (new Set(draft.questions.map((question) => question.question_id)).size !== draft.questions.length) {
      context.addIssue({ code: "custom", path: ["questions"], message: "Question IDs must be unique" });
    }
    draft.questions.forEach((question, index) => {
      if (question.question_id !== `Q${index + 1}`) {
        context.addIssue({ code: "custom", path: ["questions", index, "question_id"], message: "Question IDs must be sequential" });
      }
      if (question.question_type === "MULTIPLE_CHOICE" && question.options.length < 2) {
        context.addIssue({ code: "custom", path: ["questions", index, "options"], message: "Multiple-choice questions need at least two options" });
      }
    });
  });

export type AiActivityDraft = z.infer<typeof AiActivityDraftSchema>;

export const ActivityDraftContentSchema = z.object({
  schema_version: z.literal("1"),
  source: z.literal("AI_DRAFT"),
  instructions: z.string().trim().min(1).max(3000),
  questions: z.array(AiActivityQuestionSchema).min(1).max(20),
  print_layout_data: AiActivityDraftSchema.shape.print_layout_data,
});

export type ActivityDraftContent = z.infer<typeof ActivityDraftContentSchema>;

export function activityContentFromAiDraft(draft: AiActivityDraft): ActivityDraftContent {
  return ActivityDraftContentSchema.parse({
    schema_version: "1",
    source: "AI_DRAFT",
    instructions: draft.instructions,
    questions: draft.questions,
    print_layout_data: draft.print_layout_data,
  });
}

/** Gemini REST structured-output schema; values are validated again with Zod. */
export const AI_ACTIVITY_DRAFT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "description",
    "instructions",
    "grade",
    "subject",
    "domain",
    "unit",
    "activity_type",
    "standard_candidates",
    "questions",
    "print_layout_data",
  ],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    instructions: { type: "string" },
    grade: { type: ["integer", "null"] },
    subject: { type: ["string", "null"] },
    domain: { type: ["string", "null"] },
    unit: { type: ["string", "null"] },
    activity_type: { type: ["string", "null"] },
    standard_candidates: { type: "array", maxItems: 5, items: { type: "string" } },
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
    print_layout_data: {
      type: "object",
      additionalProperties: false,
      required: ["paper_size", "orientation", "estimated_pages"],
      properties: {
        paper_size: { type: "string", enum: ["A4"] },
        orientation: { type: "string", enum: ["PORTRAIT", "LANDSCAPE"] },
        estimated_pages: { type: "integer", minimum: 1, maximum: 10 },
      },
    },
  },
} as const;
