import { studentInputSchema, type StudentInput } from "./student.ts";

export const ROSTER_HEADERS = ["student_number", "student_name"] as const;

export type InvalidRosterRow = { rowNumber: number; reason: string };
export type ParsedRoster = {
  validRows: StudentInput[];
  invalidRows: InvalidRosterRow[];
  ignoredRowCount: number;
};

export class RosterImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RosterImportFileError";
  }
}

function cellText(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function isEmptyRow(row: unknown[]) {
  return row.every((value) => cellText(value) === "");
}

function parseStudentNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  const text = cellText(value);
  return /^-?\d+$/.test(text) ? Number(text) : null;
}

/** Pure table validation used by CSV/XLSX parsing and automated tests. */
export function parseRosterRows(rows: unknown[][]): ParsedRoster {
  const headerIndex = rows.findIndex((row) => !isEmptyRow(row));
  if (headerIndex < 0) throw new RosterImportFileError("헤더 행이 없는 빈 파일이에요.");

  const normalizedHeaders = rows[headerIndex].map((value) =>
    cellText(value).replace(/^\uFEFF/, "").toLowerCase(),
  );
  const numberColumn = normalizedHeaders.indexOf("student_number");
  const nameColumn = normalizedHeaders.indexOf("student_name");
  if (numberColumn < 0 || nameColumn < 0) {
    throw new RosterImportFileError("필수 열 student_number, student_name을 찾을 수 없어요.");
  }

  const candidates: Array<{ rowNumber: number; student: StudentInput }> = [];
  const invalidRows: InvalidRosterRow[] = [];
  let ignoredRowCount = 0;

  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const rowNumber = headerIndex + offset + 2;
    if (isEmptyRow(row)) {
      ignoredRowCount += 1;
      return;
    }

    const parsed = studentInputSchema.safeParse({
      studentNumber: parseStudentNumber(row[numberColumn]),
      name: cellText(row[nameColumn]),
    });
    if (!parsed.success) {
      invalidRows.push({ rowNumber, reason: "학생 번호와 이름을 모두 확인해 주세요." });
      return;
    }
    candidates.push({ rowNumber, student: parsed.data });
  });

  const duplicateNumbers = new Set<number>();
  const seenNumbers = new Set<number>();
  for (const candidate of candidates) {
    if (seenNumbers.has(candidate.student.studentNumber)) duplicateNumbers.add(candidate.student.studentNumber);
    seenNumbers.add(candidate.student.studentNumber);
  }

  for (const candidate of candidates) {
    if (duplicateNumbers.has(candidate.student.studentNumber)) {
      invalidRows.push({ rowNumber: candidate.rowNumber, reason: "파일 안에 같은 학생 번호가 중복되어 있어요." });
    }
  }

  return {
    validRows: candidates
      .filter((candidate) => !duplicateNumbers.has(candidate.student.studentNumber))
      .map((candidate) => candidate.student),
    invalidRows: invalidRows.sort((a, b) => a.rowNumber - b.rowNumber),
    ignoredRowCount,
  };
}
