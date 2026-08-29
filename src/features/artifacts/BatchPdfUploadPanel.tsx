"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSearch, LoaderCircle, Upload } from "lucide-react";
import { FILE_LIMITS } from "@/lib/config";
import { uploadTeacherBatchPdf } from "./batch-actions";

export type RecentBatchPdf = {
  id: string;
  fileName: string;
  pageCount: number;
  createdAt: string;
};

export function BatchPdfUploadPanel({ recentBatches }: { recentBatches: RecentBatchPdf[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    if (file.size > FILE_LIMITS.PDF_MAX_BYTES) {
      setMessage("PDF는 30MB 이하만 올릴 수 있어요.");
      return;
    }
    setPending(true);
    setMessage("오늘 활동 PDF의 원본과 페이지 수를 확인하고 있어요.");
    const formData = new FormData();
    formData.set("file", file);
    let result;
    try {
      result = await uploadTeacherBatchPdf(formData);
    } catch {
      result = { ok: false as const, message: "서버 연결이 끊겼어요. 다시 시도해 주세요." };
    }
    setPending(false);
    setMessage(result.message);
    if (result.ok) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.push(`/results/upload/batches/${result.artifactId}`);
    }
  }

  return (
    <section className="rounded-2xl border border-brand-200 bg-brand-50/40 p-5 md:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-brand-100 p-2.5 text-brand-700"><FileSearch className="h-5 w-5" /></div>
        <div>
          <h2 className="text-lg font-bold text-foreground">오늘 활동 PDF 업로드</h2>
          <p className="mt-1 text-sm text-muted">이번 수업에서 수집한 학생 활동지가 들어 있는 PDF 한 개를 선택하세요.</p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          disabled={pending}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setMessage(null);
          }}
          className="min-w-0 flex-1 rounded-lg border border-dashed border-border bg-surface px-4 py-4 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-bold file:text-brand-700"
        />
        <button type="button" onClick={upload} disabled={!file || pending} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {pending ? "업로드 중…" : "PDF 업로드"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">PDF 30MB·100쪽 이하 · 업로드 후 활동과 학생을 자동으로 인식합니다.</p>
      {message ? <p role="status" className="mt-3 rounded-lg bg-surface px-4 py-3 text-sm text-foreground">{message}</p> : null}

      {recentBatches.length > 0 ? (
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="text-sm font-bold text-foreground">최근 Batch PDF</h3>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {recentBatches.map((batch) => (
              <li key={batch.id}>
                <Link href={`/results/upload/batches/${batch.id}`} className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm hover:border-brand-300">
                  <span className="min-w-0 truncate font-medium text-foreground">{batch.fileName}</span>
                  <span className="ml-3 shrink-0 text-xs text-muted">{batch.pageCount}쪽 · 다시 검사</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
