import { z } from "zod";

/** `students.student_number smallint`와 이름 필수 계약에 맞춘 서버 입력 검증. */
export const studentInputSchema = z.object({
  studentNumber: z.number().int().min(-32768).max(32767),
  name: z.string().trim().min(1),
});

export type StudentInput = z.infer<typeof studentInputSchema>;

export function parseStudentInput(formData: FormData): StudentInput | null {
  const numberValue = String(formData.get("studentNumber") ?? "").trim();
  const result = studentInputSchema.safeParse({
    studentNumber: numberValue === "" ? Number.NaN : Number(numberValue),
    name: String(formData.get("name") ?? ""),
  });

  return result.success ? result.data : null;
}
