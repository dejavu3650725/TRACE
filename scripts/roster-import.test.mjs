import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { parseRosterFile, parseRosterRows } from "../src/features/roster/import.ts";

test("Roster parser ignores blank rows and accepts the required schema", () => {
  const result = parseRosterRows([
    ["student_number", "student_name"],
    [1, "합성 학생 1"],
    ["", ""],
    [2, "합성 학생 2"],
  ]);
  assert.deepEqual(result.validRows, [
    { studentNumber: 1, name: "합성 학생 1" },
    { studentNumber: 2, name: "합성 학생 2" },
  ]);
  assert.equal(result.ignoredRowCount, 1);
  assert.deepEqual(result.invalidRows, []);
});

test("Roster parser exposes invalid rows and blocks duplicate student numbers", () => {
  const result = parseRosterRows([
    ["student_number", "student_name"],
    [1, "합성 학생 1"],
    [1, "합성 학생 1-중복"],
    ["", "이름만 있음"],
  ]);
  assert.deepEqual(result.validRows, []);
  assert.equal(result.invalidRows.length, 3);
  assert.match(result.invalidRows[0].reason, /중복/);
  assert.match(result.invalidRows[2].reason, /번호와 이름/);
});

test("ExcelJS reads the same required template header values", async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("학생명단");
  worksheet.addRow(["student_number", "student_name"]);
  const written = await workbook.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(written);
  assert.deepEqual(loaded.worksheets[0].getRow(1).values.slice(1), ["student_number", "student_name"]);
});

test("CSV and XLSX files both use the same server-side roster validation", async () => {
  const csvFile = new File([
    "student_number,student_name\n3,합성 학생 3\n\n4,합성 학생 4\n",
  ], "synthetic-roster.csv", { type: "text/csv" });
  const csvResult = await parseRosterFile(csvFile);
  assert.equal(csvResult.validRows.length, 2);
  assert.equal(csvResult.ignoredRowCount, 1);

  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("학생명단").addRows([
    ["student_number", "student_name"],
    [5, "합성 학생 5"],
  ]);
  const xlsxFile = new File([await workbook.xlsx.writeBuffer()], "synthetic-roster.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const xlsxResult = await parseRosterFile(xlsxFile);
  assert.deepEqual(xlsxResult.validRows, [{ studentNumber: 5, name: "합성 학생 5" }]);
});
