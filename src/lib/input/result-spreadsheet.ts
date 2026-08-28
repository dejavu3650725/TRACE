import "server-only";
import ExcelJS from "exceljs";

/**
 * ISSUE-21/22 — TRACE 표준 학생 결과 스프레드시트 공통 규약
 * Header: student_number | student_name | Q1..Qn (활동 문항에서 파생, 임의 매핑 금지)
 * 학급명 컬럼은 두지 않는다 — Class는 ActivityAssignment로 이미 결정된다.
 */

export const FIXED_HEADERS = ["student_number", "student_name"] as const;
export const FALLBACK_QUESTION_IDS = ["Q1", "Q2"];

export function deriveQuestionIds(contentJson: unknown): string[] {
  if (
    contentJson &&
    typeof contentJson === "object" &&
    Array.isArray((contentJson as { questions?: unknown }).questions)
  ) {
    const ids = (contentJson as { questions: Array<{ question_id?: unknown }> }).questions
      .map((q) => (typeof q.question_id === "string" ? q.question_id : null))
      .filter((v): v is string => Boolean(v));
    if (ids.length > 0) return ids;
  }
  return FALLBACK_QUESTION_IDS;
}

export interface ParsedResultRow {
  rowNo: number;
  studentNumber: number | null;
  studentName: string;
  answers: Record<string, string>;
}

export interface ParsedResultFile {
  headers: string[];
  rows: ParsedResultRow[];
}

/** header 배열이 표준과 정확히 일치해야 한다 (임의 header 매핑 금지). */
export function validateHeaders(headers: string[], questionIds: string[]): string | null {
  const expected = [...FIXED_HEADERS, ...questionIds];
  if (headers.length !== expected.length) {
    return `열 구성이 표준 템플릿과 달라요. (기대: ${expected.join(", ")})`;
  }
  for (let i = 0; i < expected.length; i += 1) {
    if (headers[i]?.trim() !== expected[i]) {
      return `열 "${headers[i] ?? "(빈 열)"}"이(가) 표준 템플릿과 달라요. (기대: ${expected[i]})`;
    }
  }
  return null;
}

function rowsFromMatrix(matrix: string[][], questionIds: string[]): ParsedResultFile {
  const headers = (matrix[0] ?? []).map((h) => String(h ?? "").trim());
  const rows: ParsedResultRow[] = [];
  for (let r = 1; r < matrix.length; r += 1) {
    const cells = matrix[r] ?? [];
    if (cells.every((c) => String(c ?? "").trim() === "")) continue; // 빈 줄 무시
    const numberRaw = String(cells[0] ?? "").trim();
    const parsedNumber = Number(numberRaw);
    const answers: Record<string, string> = {};
    questionIds.forEach((qid, i) => {
      answers[qid] = String(cells[FIXED_HEADERS.length + i] ?? "").trim();
    });
    rows.push({
      rowNo: r + 1,
      studentNumber: numberRaw !== "" && Number.isInteger(parsedNumber) ? parsedNumber : null,
      studentName: String(cells[1] ?? "").trim(),
      answers,
    });
  }
  return { headers, rows };
}

/** RFC4180 수준의 단순 CSV 파서 (따옴표/이스케이프 지원) */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      out.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    out.push(row);
  }
  return out;
}

export async function parseResultFile(
  fileName: string,
  buffer: Buffer,
  questionIds: string[],
): Promise<ParsedResultFile> {
  if (/\.csv$/i.test(fileName)) {
    return rowsFromMatrix(parseCsv(buffer.toString("utf-8")), questionIds);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };
  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells: string[] = [];
    const width = Math.max(row.cellCount, FIXED_HEADERS.length + questionIds.length);
    for (let c = 1; c <= width; c += 1) {
      const value = row.getCell(c).value;
      cells.push(value === null || value === undefined ? "" : String(value));
    }
    matrix[rowNumber - 1] = cells;
  });
  return rowsFromMatrix(matrix.filter(Boolean), questionIds);
}

export function buildStructuredInput(questionIds: string[], answers: Record<string, string>) {
  return {
    schema_version: "1",
    questions: questionIds.map((qid) => ({
      question_id: qid,
      response_type: "long_text",
      response: { raw_text: answers[qid] ?? "" },
    })),
  };
}
