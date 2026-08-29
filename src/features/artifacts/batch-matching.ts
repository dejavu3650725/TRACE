import type { StructuredInputRuntime } from "../submissions/structured-input-schema.ts";

export type VisibleStudentIdentity = Readonly<{
  grade: string | null;
  className: string | null;
  studentNumber: string | null;
  studentName: string | null;
  uncertain: boolean;
}>;

export type BatchRosterStudent = Readonly<{
  id: string;
  studentNumber: number;
  studentName: string;
}>;

export type BatchIdentityMatch =
  | Readonly<{ status: "MATCHED"; student: BatchRosterStudent }>
  | Readonly<{
      status: "REVIEW_PENDING";
      reason: "MISSING_IDENTITY" | "UNCERTAIN_IDENTITY" | "NO_EXACT_MATCH" | "AMBIGUOUS_EXACT_MATCH";
    }>;

function normalizedName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

function exactStudentNumber(value: string | null): number | null {
  if (!value || !/^[1-9][0-9]{0,4}$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isSafeInteger(number) ? number : null;
}

/** Exact number+name matching only. Input order never participates in identity resolution. */
export function matchVisibleStudentIdentity(
  identity: VisibleStudentIdentity,
  roster: readonly BatchRosterStudent[],
): BatchIdentityMatch {
  if (identity.uncertain) return { status: "REVIEW_PENDING", reason: "UNCERTAIN_IDENTITY" };
  const studentNumber = exactStudentNumber(identity.studentNumber);
  const studentName = identity.studentName ? normalizedName(identity.studentName) : "";
  if (studentNumber === null || studentName.length === 0) {
    return { status: "REVIEW_PENDING", reason: "MISSING_IDENTITY" };
  }

  const matches = roster.filter((student) => (
    student.studentNumber === studentNumber
    && normalizedName(student.studentName) === studentName
  ));
  if (matches.length === 1) return { status: "MATCHED", student: matches[0] };
  return {
    status: "REVIEW_PENDING",
    reason: matches.length === 0 ? "NO_EXACT_MATCH" : "AMBIGUOUS_EXACT_MATCH",
  };
}

export type BatchExtractedQuestion = Readonly<{
  questionId: string;
  visiblePrompt: string | null;
  responseType: StructuredInputRuntime["questions"][number]["response_type"];
  response: StructuredInputRuntime["questions"][number]["response"];
  uncertain: boolean;
}>;

export type BatchExtractedGroup = Readonly<{
  rangeIndex: number;
  identity: VisibleStudentIdentity;
  questions: readonly BatchExtractedQuestion[];
}>;
