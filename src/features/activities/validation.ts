import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const activityInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  grade: z.number().int().min(1).max(12).nullable(),
  subject: optionalText(100),
  domain: optionalText(200),
  unit: optionalText(200),
  activityType: optionalText(100),
  description: optionalText(5000),
  parentActivityId: z.string().uuid().nullable(),
  standardIds: z.array(z.string().trim().min(1).max(100)).max(30),
});

export type ActivityInput = z.infer<typeof activityInputSchema>;

export function parseActivityInput(formData: FormData): ActivityInput | null {
  const gradeValue = String(formData.get("grade") ?? "").trim();
  const parentValue = String(formData.get("parentActivityId") ?? "").trim();
  const standardIds = [...new Set(formData.getAll("standardIds").map(String).map((value) => value.trim()))];
  const parsed = activityInputSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    grade: gradeValue === "" ? null : Number(gradeValue),
    subject: String(formData.get("subject") ?? ""),
    domain: String(formData.get("domain") ?? ""),
    unit: String(formData.get("unit") ?? ""),
    activityType: String(formData.get("activityType") ?? ""),
    description: String(formData.get("description") ?? ""),
    parentActivityId: parentValue === "" ? null : parentValue,
    standardIds,
  });

  return parsed.success ? parsed.data : null;
}

const assignmentStatusSchema = z.enum(["OPEN", "CLOSED", "ARCHIVED"]);

export type AssignmentScheduleInput = {
  status: z.infer<typeof assignmentStatusSchema>;
  openAt: string | null;
  dueAt: string | null;
};

function parseKoreanLocalDateTime(value: FormDataEntryValue | null): string | null | undefined {
  const raw = String(value ?? "").trim();
  if (raw === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return undefined;

  const parsed = new Date(`${raw}:00+09:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function parseAssignmentSchedule(formData: FormData): AssignmentScheduleInput | null {
  const status = assignmentStatusSchema.safeParse(String(formData.get("status") ?? "OPEN"));
  const openAt = parseKoreanLocalDateTime(formData.get("openAt"));
  const dueAt = parseKoreanLocalDateTime(formData.get("dueAt"));

  if (!status.success || openAt === undefined || dueAt === undefined) return null;
  if (openAt && dueAt && new Date(dueAt) < new Date(openAt)) return null;

  return { status: status.data, openAt, dueAt };
}

