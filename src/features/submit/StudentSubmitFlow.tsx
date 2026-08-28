"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { analyzeImageQuality } from "./quality";

/**
 * ISSUE-19 — 학생 모바일 다중 촬영 제출 흐름 (검증 → 촬영 → 제출)
 * ISSUE-20 — 촬영 품질 경고 (경고만, "그래도 제출" 허용)
 * 학생 브라우저는 roster를 조회하지 않는다 — 모든 확인은 서버 API가 수행.
 */

type Step = "verify" | "capture" | "done";

interface PhotoItem {
  id: string;
  file: File;
  previewUrl: string;
  status: "ready" | "uploading" | "uploaded" | "failed";
  artifactId?: string;
  warnings: string[];
}

interface Session {
  submissionId: string;
  sessionCode: string;
  activityTitle: string;
  studentDisplay: string;
}

export function StudentSubmitFlow({ token }: { token: string }) {
  const [step, setStep] = useState<Step>("verify");
  const [session, setSession] = useState<Session | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [doneCount, setDoneCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 1단계: 본인 확인 ──
  const onVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setVerifying(true);
    setVerifyError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/public/submission/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          class_code: String(fd.get("class_code") ?? ""),
          student_number: String(fd.get("student_number") ?? ""),
          student_name: String(fd.get("student_name") ?? ""),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setVerifyError(json.message ?? "확인에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      setSession({
        submissionId: json.submission_id,
        sessionCode: json.session_code,
        activityTitle: json.activity_title,
        studentDisplay: json.student_display,
      });
      setStep("capture");
    } catch {
      setVerifyError("네트워크 오류가 발생했어요. 다시 시도해 주세요.");
    } finally {
      setVerifying(false);
    }
  };

  // ── 2단계: 사진 추가 (품질 검사 포함) ──
  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const { warnings } = await analyzeImageQuality(file);
      setPhotos((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          status: "ready",
          warnings,
        },
      ]);
    }
  };

  const removePhoto = async (photo: PhotoItem) => {
    if (photo.status === "uploaded" && photo.artifactId && session) {
      await fetch("/api/public/submission/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: session.submissionId,
          session_code: session.sessionCode,
          artifact_id: photo.artifactId,
        }),
      }).catch(() => undefined);
    }
    URL.revokeObjectURL(photo.previewUrl);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  };

  const uploadOne = async (photo: PhotoItem): Promise<boolean> => {
    if (!session) return false;
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: "uploading" } : p)));
    const fd = new FormData();
    fd.set("submission_id", session.submissionId);
    fd.set("session_code", session.sessionCode);
    fd.set("file", photo.file);
    try {
      const res = await fetch("/api/public/submission/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message);
      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, status: "uploaded", artifactId: json.artifact_id } : p)),
      );
      return true;
    } catch {
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: "failed" } : p)));
      return false;
    }
  };

  // ── 제출: 남은 사진 순차 업로드 → 완료 확정 (부분 실패 복구 가능) ──
  const onSubmitAll = async () => {
    if (!session || photos.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    let allOk = true;
    for (const photo of photos) {
      if (photo.status === "uploaded") continue;
      const ok = await uploadOne(photo);
      if (!ok) allOk = false;
    }
    if (!allOk) {
      setSubmitError("일부 사진 업로드에 실패했어요. 실패한 사진을 다시 시도하거나 삭제 후 제출해 주세요.");
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch("/api/public/submission/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: session.submissionId,
          session_code: session.sessionCode,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message);
      setDoneCount(json.page_count ?? photos.length);
      setStep("done");
    } catch {
      setSubmitError("제출 확정에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const uploadedOrReady = photos.filter((p) => p.status !== "failed").length;
  const inputClass =
    "w-full rounded-xl border border-line bg-white px-4 py-3.5 text-base outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  if (step === "done") {
    return (
      <div className="space-y-5 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
        <div>
          <p className="text-xl font-bold text-foreground">제출 완료!</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {session?.studentDisplay} · {session?.activityTitle}
            <br />
            사진 {doneCount}장이 선생님께 전달됐어요.
          </p>
        </div>
        <p className="rounded-xl bg-brand-50 px-4 py-3 text-xs leading-relaxed text-brand-700">
          이 화면은 닫아도 돼요. 제출한 활동지는 선생님 확인 후 학습 기록으로 이어져요.
        </p>
      </div>
    );
  }

  if (step === "capture" && session) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
          {session.studentDisplay} 확인 완료 · {session.activityTitle}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {photos.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-6 py-12 text-brand-700"
          >
            <Camera className="h-10 w-10" />
            <span className="text-base font-bold">활동지 촬영하기</span>
            <span className="text-xs text-muted">여러 장이면 한 장씩 차례로 찍어요</span>
          </button>
        ) : (
          <ul className="space-y-3">
            {photos.map((photo, i) => (
              <li key={photo.id} className="overflow-hidden rounded-2xl border border-line bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.previewUrl} alt={`${i + 1}페이지 미리보기`} className="max-h-64 w-full object-contain" />
                {photo.warnings.length > 0 && (
                  <p className="flex items-center gap-1.5 border-t border-warning/20 bg-warning-bg px-4 py-2 text-xs font-semibold text-warning">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {photo.warnings.join(" · ")} — 다시 찍는 걸 추천하지만 그래도 제출할 수 있어요
                  </p>
                )}
                <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
                  <span className="text-sm font-semibold text-foreground">
                    {i + 1}페이지
                    {photo.status === "uploaded" && <span className="ml-2 text-xs font-bold text-success">업로드 완료</span>}
                    {photo.status === "uploading" && <span className="ml-2 text-xs text-muted">업로드 중…</span>}
                    {photo.status === "failed" && <span className="ml-2 text-xs font-bold text-danger">실패</span>}
                  </span>
                  <span className="flex items-center gap-1">
                    {photo.status === "failed" && (
                      <button type="button" onClick={() => void uploadOne(photo)} className="rounded-lg p-2 text-brand-700 hover:bg-brand-50" aria-label="다시 업로드">
                        <RefreshCcw className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => void removePhoto(photo)} className="rounded-lg p-2 text-muted hover:bg-danger-bg hover:text-danger" aria-label="사진 삭제">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {photos.length > 0 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold text-foreground"
          >
            <ImagePlus className="h-4 w-4" /> 페이지 추가 촬영
          </button>
        )}

        {submitError && (
          <p className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">{submitError}</p>
        )}

        <button
          type="button"
          disabled={submitting || uploadedOrReady === 0}
          onClick={() => void onSubmitAll()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-4 text-base font-bold text-white disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> 제출 중…
            </>
          ) : (
            `사진 ${photos.length}장 제출하기`
          )}
        </button>
        <p className="text-center text-xs text-muted">제출하면 사진이 선생님에게만 안전하게 전달돼요.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onVerify} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-bold text-foreground">학급 코드</span>
        <input
          name="class_code"
          required
          maxLength={6}
          autoComplete="off"
          placeholder="선생님이 알려준 6자리"
          className={`${inputClass} text-center font-display text-xl font-bold uppercase tracking-[0.4em]`}
        />
      </label>
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-bold text-foreground">번호</span>
          <input name="student_number" required type="number" min={1} max={99} inputMode="numeric" placeholder="7" className={inputClass} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-bold text-foreground">이름</span>
          <input name="student_name" required autoComplete="off" placeholder="이름을 정확히 입력" className={inputClass} />
        </label>
      </div>

      {verifyError && (
        <p role="alert" className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
          {verifyError}
        </p>
      )}

      <button
        type="submit"
        disabled={verifying}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-4 text-base font-bold text-white disabled:opacity-50"
      >
        {verifying ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" /> 확인 중…
          </>
        ) : (
          "확인하고 제출 시작"
        )}
      </button>
      <p className="text-center text-xs leading-relaxed text-muted">
        입력한 정보는 본인 확인에만 쓰여요 · 학생 이름과 번호는 AI로 전송되지 않습니다
      </p>
    </form>
  );
}
