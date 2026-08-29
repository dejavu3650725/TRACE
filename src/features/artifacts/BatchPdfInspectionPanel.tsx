"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, LoaderCircle, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { createTeacherArtifactSignedUrl } from "./actions";
import { replaceTeacherBatchPageRanges } from "./batch-actions";
import type { BatchPageRange } from "./batch-ranges";

type SavedRange = BatchPageRange & { id?: string };

export function BatchPdfInspectionPanel({
  artifactId,
  fileName,
  pageCount,
  initialSignedUrl,
  initialRanges,
}: {
  artifactId: string;
  fileName: string;
  pageCount: number;
  initialSignedUrl: string;
  initialRanges: (BatchPageRange & { id: string })[];
}) {
  const router = useRouter();
  const [signedUrl, setSignedUrl] = useState(initialSignedUrl);
  const [selectedPage, setSelectedPage] = useState(1);
  const [ranges, setRanges] = useState<SavedRange[]>(
    initialRanges.length > 0 ? initialRanges : [{ page_start: 1, page_end: pageCount }],
  );
  const [pending, setPending] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateRange(index: number, key: keyof BatchPageRange, value: number) {
    setRanges((current) => current.map((range, rangeIndex) => (
      rangeIndex === index ? { ...range, [key]: value, id: undefined } : range
    )));
    setMessage(null);
  }

  function addRange() {
    const usedPages = new Set<number>();
    for (const range of ranges) {
      for (let page = range.page_start; page <= range.page_end; page += 1) usedPages.add(page);
    }
    const firstUnused = Array.from({ length: pageCount }, (_, index) => index + 1)
      .find((page) => !usedPages.has(page));
    if (!firstUnused) {
      setMessage("모든 페이지가 이미 구간에 포함되어 있어요.");
      return;
    }
    setRanges((current) => [...current, { page_start: firstUnused, page_end: firstUnused }]);
    setSelectedPage(firstUnused);
  }

  async function save() {
    setPending(true);
    setMessage("페이지 구간을 저장하고 있어요.");
    const result = await replaceTeacherBatchPageRanges({
      sourceArtifactId: artifactId,
      pageCount,
      ranges: ranges.map(({ page_start, page_end }) => ({ page_start, page_end })),
    });
    setPending(false);
    setMessage(result.message);
    if (result.ok) {
      setRanges(result.ranges);
      router.refresh();
    }
  }

  async function renewSignedUrl() {
    setRenewing(true);
    const result = await createTeacherArtifactSignedUrl(artifactId);
    setRenewing(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setSignedUrl(result.url);
    setMessage("원본 열람 링크를 5분 연장했어요.");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{fileName}</p>
            <p className="text-xs text-muted">현재 {selectedPage}쪽 / 전체 {pageCount}쪽</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={renewSignedUrl} disabled={renewing} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-background disabled:opacity-50">
              <RefreshCw className={renewing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> 링크 연장
            </button>
            <a href={`${signedUrl}#page=${selectedPage}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-brand-600 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50">
              새 창 <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <iframe
          key={`${signedUrl}-${selectedPage}`}
          src={`${signedUrl}#page=${selectedPage}&view=FitH`}
          title={`Batch PDF ${selectedPage}쪽 미리보기`}
          className="h-[68vh] min-h-[560px] w-full bg-background"
        />
        <div className="border-t border-border p-3">
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
              <button key={page} type="button" onClick={() => setSelectedPage(page)} className={page === selectedPage ? "h-8 min-w-8 rounded-md bg-brand-600 px-2 text-xs font-bold text-white" : "h-8 min-w-8 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground hover:border-brand-300"}>
                {page}
              </button>
            ))}
          </div>
        </div>
      </section>

      <aside className="self-start rounded-2xl border border-border bg-surface p-5 xl:sticky xl:top-6">
        <h2 className="text-lg font-bold text-foreground">페이지 구간</h2>
        <p className="mt-1 text-sm text-muted">한 묶음으로 볼 시작·끝 쪽을 지정하세요. 학생 이름 연결은 이슈 29에서 진행합니다.</p>
        <div className="mt-5 space-y-3">
          {ranges.map((range, index) => (
            <div key={range.id ?? `draft-${index}`} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setSelectedPage(Math.max(1, Math.min(pageCount, range.page_start)))} className="text-sm font-bold text-brand-700 hover:underline">구간 {index + 1}</button>
                <button type="button" onClick={() => setRanges((current) => current.filter((_, rangeIndex) => rangeIndex !== index))} disabled={ranges.length === 1} aria-label={`구간 ${index + 1} 삭제`} className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs font-medium text-muted">시작 쪽<input type="number" min={1} max={pageCount} value={range.page_start} onChange={(event) => updateRange(index, "page_start", Number(event.target.value))} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" /></label>
                <label className="grid gap-1 text-xs font-medium text-muted">끝 쪽<input type="number" min={1} max={pageCount} value={range.page_end} onChange={(event) => updateRange(index, "page_end", Number(event.target.value))} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" /></label>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRange} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-brand-400 px-4 py-2.5 text-sm font-bold text-brand-700 hover:bg-brand-50"><Plus className="h-4 w-4" /> 구간 추가</button>
        {message ? <p role="status" className="mt-3 rounded-lg bg-background px-3 py-2.5 text-sm text-foreground">{message}</p> : null}
        <button type="button" onClick={save} disabled={pending || ranges.length === 0} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {pending ? "저장 중…" : "페이지 구간 저장"}
        </button>
      </aside>
    </div>
  );
}
