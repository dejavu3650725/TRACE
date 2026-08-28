"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTeacherOwnership } from "@/lib/auth/ownership";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { parseStudentInput } from "./student";

const idSchema = z.string().uuid();

function rosterPath(classId: string, query?: string) {
  const path = `/classes/${classId}`;
  return query ? `${path}?${query}` : path;
}

function validClassId(formData: FormData): string | null {
  const result = idSchema.safeParse(String(formData.get("classId") ?? ""));
  return result.success ? result.data : null;
}

function failurePath(classId: string | null, reason: "invalid-input" | "duplicate-number") {
  return classId ? rosterPath(classId, `roster-error=${reason}`) : "/classes?error=invalid-input";
}

function isDuplicateStudentNumber(error: { code?: string } | null) {
  return error?.code === "23505";
}

export async function addStudent(formData: FormData) {
  const classId = validClassId(formData);
  const input = parseStudentInput(formData);
  if (!classId || !input) redirect(failurePath(classId, "invalid-input"));

  await requireTeacherOwnership("class", classId);
  const { supabase } = await requireSessionTeacher();
  const { data, error } = await supabase
    .from("students")
    .insert({ class_id: classId, student_number: input.studentNumber, name: input.name, is_active: true })
    .select("id")
    .single();

  if (isDuplicateStudentNumber(error)) redirect(failurePath(classId, "duplicate-number"));
  if (error || !data) throw new Error("Student creation failed", { cause: error });

  revalidatePath(rosterPath(classId));
  redirect(rosterPath(classId, "roster=added"));
}

export async function updateStudent(formData: FormData) {
  const classId = validClassId(formData);
  const studentIdResult = idSchema.safeParse(String(formData.get("studentId") ?? ""));
  const input = parseStudentInput(formData);
  if (!classId || !studentIdResult.success || !input) {
    redirect(failurePath(classId, "invalid-input"));
  }

  await Promise.all([
    requireTeacherOwnership("class", classId),
    requireTeacherOwnership("student", studentIdResult.data),
  ]);
  const { supabase } = await requireSessionTeacher();
  const { data, error } = await supabase
    .from("students")
    .update({
      student_number: input.studentNumber,
      name: input.name,
      is_active: formData.get("isActive") === "on",
    })
    .eq("id", studentIdResult.data)
    .eq("class_id", classId)
    .select("id")
    .maybeSingle();

  if (isDuplicateStudentNumber(error)) redirect(failurePath(classId, "duplicate-number"));
  if (error || !data) throw new Error("Student update failed", { cause: error });

  revalidatePath(rosterPath(classId));
  redirect(rosterPath(classId, "roster=updated"));
}
