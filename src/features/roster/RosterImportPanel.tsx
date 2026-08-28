"use client";

import { useActionState, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { FILE_LIMITS } from "@/lib/config";
import {
  previewRosterImport,
  commitRosterImport,
} from "./import-actions";
import type { RosterPreviewState } from "./import-actions";

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

export function RosterImportPanel({ classId }: { classId: string }) {
  const [preview, previewAction, isPreviewPending] = useActionState(
    previewRosterImport,
    initialRosterPreview,
  );
  const [clientError, setClientError] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-foreground">명단 파일 가져오기</h2>
          <p className="mt-1 text-sm text-muted">템플릿을 내려받아 작성한 뒤, 검증 결과를 확인하고 저장해요.</p>
        </div>
        <div className="flex gap-2 text-sm font-semibold">
          <a href="/api/roster-template?format=xlsx" className="rounded-lg border border-border px-3 py-2 text-foreground hover:bg-background">XLSX 템플릿</a>
          <a href="/api/roster-template?format=csv" className="rounded-lg border border-border px-3 py-2 text-foreground hover:bg-background">CSV 템플릿</a>
        </div>
      </div>

      <form action={previewAction} className="mt-5 flex flex-wrap items-end gap-3 rounded-xl bg-background p-4">
        <input type="hidden" name="classId" value={classId} />
        <label className="grid flex-1 gap-1.5 text-sm font-medium text-foreground">
          CSV 또는 XLSX 파일 <span className="font-normal text-muted">(최대 10MB)</span>
          <input
            required
            name="rosterFile"
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setClientError(file && file.size > FILE_LIMITS.SPREADSHEET_MAX_BYTES ? "명단 파일은 10MB 이하여야 해요." : null);
            }}
          />
        </label>
        <button disabled={Boolean(clientError) || isPreviewPending} type="submit" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 hover:bg-brand-700">
          <Upload className="h-4 w-4" /> {isPreviewPending ? "검증 중" : "미리보기"}
        </button>
      </form>

      {clientError && <p className="mt-3 text-sm text-danger">{clientError}</p>}
      {preview.status === "error" && <p className="mt-4 rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">{preview.message}</p>}

      {preview.status === "ready" && (
        <div className="mt-4 space-y-4 rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-success-bg px-3 py-1 font-semibold text-success">추가 {preview.insertCount}명</span>
            <span className="rounded-full bg-info-bg px-3 py-1 font-semibold text-info">수정 {preview.updateCount}명</span>
            {preview.ignoredRowCount > 0 && <span className="text-muted">빈 행 {preview.ignoredRowCount}개는 제외했어요.</span>}
          </div>

          {preview.invalidRows.length > 0 && (
            <div className="rounded-lg bg-warning-bg p-3 text-sm text-warning">
              <p className="font-bold">저장하지 않는 오류 행 {preview.invalidRows.length}개</p>
              <ul className="mt-1 list-disc pl-5">
                {preview.invalidRows.map((row) => <li key={`${row.rowNumber}-${row.reason}`}>{row.rowNumber}행: {row.reason}</li>)}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-muted"><tr><th className="px-2 py-2">번호</th><th className="px-2 py-2">이름</th><th className="px-2 py-2">처리</th></tr></thead>
              <tbody>{preview.validRows.map((row) => <tr key={row.studentNumber} className="border-b border-border last:border-0"><td className="px-2 py-2">{row.studentNumber}</td><td className="px-2 py-2">{row.name}</td><td className="px-2 py-2">{preview.updateStudentNumbers.includes(row.studentNumber) ? "수정" : "추가"}</td></tr>)}</tbody>
            </table>
          </div>

          <form action={commitRosterImport}>
            <input type="hidden" name="classId" value={classId} />
            <input type="hidden" name="rows" value={JSON.stringify(preview.validRows)} />
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700"><FileSpreadsheet className="h-4 w-4" /> {preview.validRows.length}명 저장 및 가져오기 기록 남기기</button>
          </form>
        </div>
      )}
    </section>
  );
}
