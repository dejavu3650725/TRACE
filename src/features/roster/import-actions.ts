"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTeacherOwnership } from "@/lib/auth/ownership";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { parseRosterFile, RosterImportFileError, type InvalidRosterRow } from "./import";
import { studentInputSchema, type StudentInput } from "./student";

const idSchema = z.string().uuid();
const commitRowsSchema = z.array(studentInputSchema).min(1);

export type RosterPreviewState = {
  status: "idle" | "ready" | "error";
  message: string | null;
  validRows: StudentInput[];
  invalidRows: InvalidRosterRow[];
  ignoredRowCount: number;
  insertCount: number;
  updateCount: number;
  updateStudentNumbers: number[];
};

const initialRosterPreview: RosterPreviewState = {
  status: "idle",
  message: null,
  validRows: [],
  invalidRows: [],
  ignoredRowCount: 0,
  insertCount: 0,
  updateCount: 0,
  updateStudentNumbers: [],
};

function classPath(classId: string, query?: string) {
  const path = `/classes/${classId}`;
  return query ? `${path}?${query}` : path;
}

function classIdFromForm(formData: FormData) {
  const result = idSchema.safeParse(String(formData.get("classId") ?? ""));
  return result.success ? result.data : null;
}

function errorPreview(message: string): RosterPreviewState {
  return { ...initialRosterPreview, status: "error", message };
}

/** Parses only on the server. The selected file and its contents never enter audit metadata. */
export async function previewRosterImport(
  _previousState: RosterPreviewState,
  formData: FormData,
): Promise<RosterPreviewState> {
  const classId = classIdFromForm(formData);
  const file = formData.get("rosterFile");
  if (!classId || !(file instanceof File)) return errorPreview("업로드할 명단 파일을 선택해 주세요.");

  await requireTeacherOwnership("class", classId);
  try {
    const parsed = await parseRosterFile(file);
    if (parsed.validRows.length === 0) {
      return { ...parsed, ...errorPreview("저장할 유효한 학생 행이 없어요.") };
    }

    const { supabase } = await requireSessionTeacher();
    const { data: existingStudents, error } = await supabase
      .from("students")
      .select("student_number")
      .eq("class_id", classId);
    if (error) throw new Error("Roster preview lookup failed", { cause: error });

    const existingNumbers = new Set((existingStudents ?? []).map((student) => student.student_number));
    const updateStudentNumbers = parsed.validRows
      .filter((row) => existingNumbers.has(row.studentNumber))
      .map((row) => row.studentNumber);
    return {
      ...parsed,
      status: "ready",
      message: null,
      insertCount: parsed.validRows.length - updateStudentNumbers.length,
      updateCount: updateStudentNumbers.length,
      updateStudentNumbers,
    };
  } catch (error) {
    if (error instanceof RosterImportFileError) return errorPreview(error.message);
    throw error;
  }
}

export async function commitRosterImport(formData: FormData) {
  const classId = classIdFromForm(formData);
  if (!classId) redirect("/classes?error=invalid-input");

  let rows: unknown;
  try {
    rows = JSON.parse(String(formData.get("rows") ?? ""));
  } catch {
    redirect(classPath(classId, "roster-error=import-failed"));
  }
  const parsedRows = commitRowsSchema.safeParse(rows);
  if (!parsedRows.success) redirect(classPath(classId, "roster-error=import-failed"));

  await requireTeacherOwnership("class", classId);
  const { supabase } = await requireSessionTeacher();
  const { error } = await supabase.rpc("commit_roster_import", {
    p_class_id: classId,
    p_students: parsedRows.data.map((row) => ({
      student_number: row.studentNumber,
      student_name: row.name,
    })),
  });
  if (error) {
    // Never log roster rows, names, or file contents. DB error shape is enough to diagnose import infrastructure.
    console.error("Roster import RPC failed", { code: error.code, message: error.message });
    redirect(classPath(classId, "roster-error=import-failed"));
  }

  revalidatePath(classPath(classId));
  redirect(classPath(classId, "roster=imported"));
}
