"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTeacherOwnership } from "@/lib/auth/ownership";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { CLASS_CODE } from "@/lib/config";
import { calculateClassCodeExpiry, generateClassCode } from "./class-code";

const classInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  grade: z.number().int().min(1).max(12).nullable(),
  subject: z.string().trim().max(100).nullable(),
  issueCode: z.boolean(),
});

const classUpdateSchema = classInputSchema.extend({
  classId: z.string().uuid(),
});

type ClassInput = z.infer<typeof classInputSchema>;

function parseClassInput(formData: FormData): ClassInput | null {
  const gradeValue = String(formData.get("grade") ?? "").trim();
  const subjectValue = String(formData.get("subject") ?? "").trim();
  const result = classInputSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    grade: gradeValue === "" ? null : Number(gradeValue),
    subject: subjectValue === "" ? null : subjectValue,
    issueCode: formData.get("issueCode") === "on",
  });
  return result.success ? result.data : null;
}

function inputFailurePath(path: string) {
  return `${path}${path.includes("?") ? "&" : "?"}error=invalid-input`;
}

function classCodeValues() {
  return {
    class_code: generateClassCode(CLASS_CODE.LENGTH),
    class_code_expires_at: calculateClassCodeExpiry(
      new Date(),
      CLASS_CODE.VALIDITY_HOURS,
    ).toISOString(),
  };
}

/** Generates a new opaque code. The DB unique constraint remains the final collision guard. */
async function insertClassWithUniqueCode(
  input: ClassInput,
  teacherId: string,
  supabase: Awaited<ReturnType<typeof requireSessionTeacher>>["supabase"],
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = input.issueCode ? classCodeValues() : { class_code: null, class_code_expires_at: null };
    const { data, error } = await supabase
      .from("classes")
      .insert({ teacher_id: teacherId, name: input.name, grade: input.grade, subject: input.subject, ...code })
      .select("id")
      .single();

    if (!error && data) return data;
    if (error?.code !== "23505" || !input.issueCode) {
      throw new Error("Class creation failed", { cause: error });
    }
  }

  throw new Error("Could not issue a unique Class Code after bounded retries");
}

export async function createClass(formData: FormData) {
  const input = parseClassInput(formData);
  if (!input) redirect(inputFailurePath("/classes"));

  const { teacher, supabase } = await requireSessionTeacher();
  const created = await insertClassWithUniqueCode(input, teacher.id, supabase);

  revalidatePath("/classes");
  redirect(`/classes/${created.id}`);
}

export async function updateClass(formData: FormData) {
  const input = parseClassInput(formData);
  const classId = String(formData.get("classId") ?? "");
  const parsed = classUpdateSchema.safeParse(input ? { ...input, classId } : null);
  if (!parsed.success) redirect(inputFailurePath(`/classes/${classId}`));

  await requireTeacherOwnership("class", parsed.data.classId);
  const { teacher, supabase } = await requireSessionTeacher();
  const { data, error } = await supabase
    .from("classes")
    .update({ name: parsed.data.name, grade: parsed.data.grade, subject: parsed.data.subject })
    .eq("id", parsed.data.classId)
    .eq("teacher_id", teacher.id)
    .select("id")
    .single();

  if (error || !data) throw new Error("Class update failed", { cause: error });
  revalidatePath("/classes");
  revalidatePath(`/classes/${parsed.data.classId}`);
  redirect(`/classes/${parsed.data.classId}?updated=1`);
}

export async function reissueClassCode(formData: FormData) {
  const classId = String(formData.get("classId") ?? "");
  await requireTeacherOwnership("class", classId);
  const { teacher, supabase } = await requireSessionTeacher();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("classes")
      .update(classCodeValues())
      .eq("id", classId)
      .eq("teacher_id", teacher.id)
      .select("id")
      .single();

    if (!error && data) {
      revalidatePath("/classes");
      revalidatePath(`/classes/${classId}`);
      redirect(`/classes/${classId}?code=reissued`);
    }
    if (error?.code !== "23505") throw new Error("Class Code reissue failed", { cause: error });
  }

  throw new Error("Could not issue a unique Class Code after bounded retries");
}

/* ─── 인라인 피드백형 학급 정보 저장 (버튼 상태 UX용) ─── */

export interface ClassFormState {
  status: "idle" | "success" | "error";
  message: string | null;
  savedAt: number | null;
}

export async function updateClassInfo(
  _prev: ClassFormState,
  formData: FormData,
): Promise<ClassFormState> {
  const input = parseClassInput(formData);
  const classId = String(formData.get("classId") ?? "");
  const parsed = classUpdateSchema.safeParse(input ? { ...input, classId } : null);
  if (!parsed.success) {
    return { status: "error", message: "입력 값을 확인해 주세요.", savedAt: null };
  }

  await requireTeacherOwnership("class", parsed.data.classId);
  const { teacher, supabase } = await requireSessionTeacher();
  const { data, error } = await supabase
    .from("classes")
    .update({ name: parsed.data.name, grade: parsed.data.grade, subject: parsed.data.subject })
    .eq("id", parsed.data.classId)
    .eq("teacher_id", teacher.id)
    .select("id")
    .single();

  if (error || !data) {
    return { status: "error", message: "저장에 실패했어요. 잠시 후 다시 시도해 주세요.", savedAt: null };
  }

  revalidatePath("/classes");
  revalidatePath(`/classes/${parsed.data.classId}`);
  return { status: "success", message: "학급 정보를 저장했어요.", savedAt: Date.now() };
}
