import ExcelJS from "exceljs";

export const runtime = "nodejs";

const TEMPLATE_ROWS = [
  ["student_number", "student_name"],
  [1, "합성 학생 1"],
  [2, "합성 학생 2"],
];

function escapeCsvCell(value: string | number) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format");
  if (format === "csv") {
    const csv = TEMPLATE_ROWS.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="trace-roster-template.csv"',
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("학생명단");
  worksheet.columns = [{ width: 18 }, { width: 24 }];
  worksheet.addRows(TEMPLATE_ROWS);
  worksheet.getRow(1).font = { bold: true };
  const file = await workbook.xlsx.writeBuffer();
  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="trace-roster-template.xlsx"',
    },
  });
}
