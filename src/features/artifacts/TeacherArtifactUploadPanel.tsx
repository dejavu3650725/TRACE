"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileCheck2, LoaderCircle, Upload } from "lucide-react";
import { FILE_LIMITS } from "@/lib/config";
import {
  createTeacherArtifactSignedUrl,
  uploadTeacherArtifact,
  type TeacherArtifactUploadResult,
} from "./actions";

export type ArtifactUploadAssignmentOption = {
  id: string;
  classId: string;
  label: string;
};

export type ArtifactUploadStudentOption = {
  id: string;
  classId: string;
  studentNumber: number;
  name: string;
};

export type RecentTeacherArtifact = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number | null;
  createdAt: string;
  studentLabel: string;
  assignmentLabel: string;
};

type UploadRow = TeacherArtifactUploadResult & { key: string; fileName: string };

function formatBytes(bytes: number | null) {
  if (bytes === null) return "크기 정보 없음";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function validateSelection(files: File[]): { kind: "images" | "pdf" } | { error: string } {
  if (files.length === 0) return { error: "업로드할 파일을 선택해 주세요." };
  const pdfs = files.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  if (pdfs.length > 0) {
    if (files.length !== 1) return { error: "PDF는 이미지와 섞지 않고 한 번에 한 파일씩 올려 주세요." };
    if (pdfs[0].size > FILE_LIMITS.PDF_MAX_BYTES) return { error: "PDF는 파일당 30MB 이하만 올릴 수 있어요." };
    return { kind: "pdf" };
  }
  if (files.length > FILE_LIMITS.BATCH_IMAGES_MAX_FILES) {
    return { error: `이미지는 한 번에 ${FILE_LIMITS.BATCH_IMAGES_MAX_FILES}개까지 올릴 수 있어요.` };
  }
  if (files.some((file) => file.size > FILE_LIMITS.IMAGE_MAX_BYTES)) {
    return { error: "이미지는 파일당 10MB 이하만 올릴 수 있어요." };
  }
  return { kind: "images" };
}

export function TeacherArtifactUploadPanel({
  assignments,
  students,
  recentArtifacts,
}: {
  assignments: ArtifactUploadAssignmentOption[];
  students: ArtifactUploadStudentOption[];
  recentArtifacts: RecentTeacherArtifact[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [assignmentId, setAssignmentId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [openingId, setOpeningId] = useState<string | null>(null);

  const assignment = assignments.find((item) => item.id === assignmentId);
  const filteredStudents = useMemo(
    () => students.filter((student) => student.classId === assignment?.classId),
    [assignment?.classId, students],
  );

  function changeAssignment(value: string) {
    setAssignmentId(value);
    setStudentId("");
    setMessage(null);
  }

  async function submit() {
    if (!assignmentId || !studentId) {
      setMessage("활동 배정과 학생을 먼저 선택해 주세요.");
      return;
    }
    const selection = validateSelection(files);
    if ("error" in selection) {
      setMessage(selection.error);
      return;
    }

    setUploading(true);
    setMessage(`${files.length}개 원본 파일을 순서대로 저장하고 있어요.`);
    const results: UploadRow[] = [];
    for (const [index, file] of files.entries()) {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("studentId", studentId);
      formData.set("activityAssignmentId", assignmentId);
      formData.set("batchFileCount", String(files.length));
      formData.set("batchKind", selection.kind);
      let result: TeacherArtifactUploadResult;
      try {
        result = await uploadTeacherArtifact(formData);
      } catch {
        result = { ok: false, message: "서버 연결이 끊겼어요. 이 파일부터 다시 시도해 주세요.", artifactId: null };
      }
      results.push({ ...result, key: `${file.name}-${file.lastModified}-${index}`, fileName: file.name });
      setRows([...results]);
      if (!result.ok) break;
    }

    const succeeded = results.filter((result) => result.ok).length;
    const failed = results.find((result) => !result.ok);
    setMessage(
      failed
        ? `${succeeded}개 저장 후 중단됐어요. 실패한 파일을 확인해 주세요.`
        : `${succeeded}개 원본 파일을 비공개 저장소에 저장했어요.`,
    );
    setUploading(false);
    if (!failed) {
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
    }
    router.refresh();
  }

  async function prepareSignedUrl(artifactId: string) {
    setOpeningId(artifactId);
    const result = await createTeacherArtifactSignedUrl(artifactId);
    setOpeningId(null);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setSignedUrls((current) => ({ ...current, [artifactId]: result.url }));
  }

  if (assignments.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-lg font-bold text-foreground">업로드할 활동 배정이 없어요</h2>
        <p className="mt-2 text-sm text-muted">활동을 학급에 배정한 뒤 이 화면으로 돌아와 주세요.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-brand-50 p-2.5 text-brand-700"><Upload className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-bold text-foreground">원본 활동지 연결</h2>
            <p className="mt-1 text-sm text-muted">활동 배정과 학생을 먼저 고른 뒤 JPG·PNG·WebP 또는 PDF를 올려 주세요.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            활동 배정
            <select value={assignmentId} onChange={(event) => changeAssignment(event.target.value)} disabled={uploading} className="rounded-lg border border-border bg-background px-3 py-2.5">
              <option value="">활동과 학급 선택</option>
              {assignments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            학생
            <select value={studentId} onChange={(event) => setStudentId(event.target.value)} disabled={!assignmentId || uploading} className="rounded-lg border border-border bg-background px-3 py-2.5">
              <option value="">학생 선택</option>
              {filteredStudents.map((student) => <option key={student.id} value={student.id}>{student.studentNumber}번 {student.name}</option>)}
            </select>
          </label>
        </div>

        <label className="mt-4 grid gap-1.5 text-sm font-medium text-foreground">
          원본 파일
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            disabled={uploading}
            onChange={(event) => {
              setFiles(Array.from(event.target.files ?? []));
              setRows([]);
              setMessage(null);
            }}
            className="rounded-lg border border-dashed border-border bg-background px-4 py-6 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:font-bold file:text-brand-700"
          />
        </label>
        <p className="mt-2 text-xs text-muted">이미지 파일당 10MB·한 번에 100개, PDF 파일당 30MB·100쪽 이하입니다. PDF는 한 파일씩 올려 주세요.</p>

        {files.length > 0 ? <p className="mt-3 text-sm font-medium text-foreground">선택: {files.length}개</p> : null}
        {message ? <p role="status" className="mt-3 rounded-lg bg-background px-4 py-3 text-sm text-foreground">{message}</p> : null}
        {rows.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {rows.map((row) => (
              <li key={row.key} className={row.ok ? "text-emerald-700" : "text-red-600"}>
                {row.ok ? "저장 완료" : "저장 실패"} · {row.fileName} — {row.message}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={submit} disabled={uploading || files.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
            {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "안전하게 저장 중…" : "원본 파일 저장"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 md:p-6">
        <div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-brand-700" /><h2 className="text-lg font-bold text-foreground">최근 저장한 원본</h2></div>
        {recentArtifacts.length === 0 ? (
          <p className="mt-4 text-sm text-muted">아직 저장한 원본 파일이 없어요.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {recentArtifacts.map((artifact) => (
              <li key={artifact.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{artifact.fileName}</p>
                  <p className="mt-1 text-xs text-muted">{artifact.assignmentLabel} · {artifact.studentLabel} · {formatBytes(artifact.fileSizeBytes)}</p>
                </div>
                {signedUrls[artifact.id] ? (
                  <a href={signedUrls[artifact.id]} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline">5분 링크로 열기 <ExternalLink className="h-4 w-4" /></a>
                ) : (
                  <button type="button" onClick={() => prepareSignedUrl(artifact.id)} disabled={openingId === artifact.id} className="shrink-0 rounded-lg border border-brand-600 px-3 py-2 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-50">
                    {openingId === artifact.id ? "권한 확인 중…" : "원본 열기"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
