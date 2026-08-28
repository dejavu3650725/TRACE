import "server-only";

import ExcelJS from "exceljs";
import { FILE_LIMITS } from "../../lib/config.ts";
import { parseRosterRows, RosterImportFileError, type ParsedRoster } from "./validation.ts";

export { parseRosterRows, RosterImportFileError } from "./validation.ts";
export type { InvalidRosterRow, ParsedRoster } from "./validation.ts";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new RosterImportFileError("CSV의 따옴표 형식이 올바르지 않아요.");
  if (cell !== "" || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

async function parseXlsx(buffer: ArrayBuffer): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook();
  const contents = Buffer.from(buffer) as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(contents);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new RosterImportFileError("읽을 수 있는 시트가 없어요.");

  const rows: unknown[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    rows[rowNumber - 1] = Array.from(row.values as unknown[]);
  });
  return rows;
}

export async function parseRosterFile(file: File): Promise<ParsedRoster> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "csv" && extension !== "xlsx") {
    throw new RosterImportFileError("CSV 또는 XLSX 파일만 올릴 수 있어요.");
  }
  if (file.size === 0) throw new RosterImportFileError("빈 파일은 가져올 수 없어요.");
  if (file.size > FILE_LIMITS.SPREADSHEET_MAX_BYTES) {
    throw new RosterImportFileError("명단 파일은 10MB 이하여야 해요.");
  }

  try {
    const buffer = await file.arrayBuffer();
    const rows = extension === "csv"
      ? parseCsv(new TextDecoder("utf-8").decode(buffer))
      : await parseXlsx(buffer);
    return parseRosterRows(rows);
  } catch (error) {
    if (error instanceof RosterImportFileError) throw error;
    throw new RosterImportFileError("파일 형식을 읽을 수 없어요. TRACE 템플릿을 사용해 주세요.");
  }
}
