"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacherOwnership } from "@/lib/auth/ownership";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { STORAGE } from "@/lib/config";
import { getOrCreateSubmission } from "@/features/submissions/foundation";
import {
  ArtifactFileValidationError,
  validateTeacherArtifactFile,
} from "./validation";

const uploadRelationSchema = z.object({
  studentId: z.string().uuid(),
  activityAssignmentId: z.string().uuid(),
  batchFileCount: z.number().int().min(1).max(100),
  batchKind: z.enum(["images", "pdf"]),
});

export type TeacherArtifactUploadResult = {
  ok: boolean;
  message: string;
  artifactId: string | null;
};

function failure(message: string): TeacherArtifactUploadResult {
  return { ok: false, message, artifactId: null };
}

export async function uploadTeacherArtifact(formData: FormData): Promise<TeacherArtifactUploadResult> {
  const { teacher, supabase } = await requireSessionTeacher();
  const file = formData.get("file");
  const parsed = uploadRelationSchema.safeParse({
    studentId: String(formData.get("studentId") ?? ""),
    activityAssignmentId: String(formData.get("activityAssignmentId") ?? ""),
    batchFileCount: Number(String(formData.get("batchFileCount") ?? "")),
    batchKind: String(formData.get("batchKind") ?? ""),
  });
  if (!parsed.success || !(file instanceof File)) {
    return failure("활동 배정, 학생, 업로드 파일을 다시 확인해 주세요.");
  }
  if (parsed.data.batchKind === "pdf" && parsed.data.batchFileCount !== 1) {
    return failure("PDF는 한 번에 한 파일씩 올려 주세요.");
  }

  let validated;
  try {
    validated = await validateTeacherArtifactFile(file);
  } catch (error) {
    return failure(
      error instanceof ArtifactFileValidationError
        ? error.message
        : "파일을 검증하지 못했어요. 다른 파일로 다시 시도해 주세요.",
    );
  }
  if (parsed.data.batchKind === "images" && !validated.mimeType.startsWith("image/")) {
    return failure("이미지 묶음에는 JPG, PNG 또는 WebP만 포함할 수 있어요.");
  }
  if (parsed.data.batchKind === "pdf" && validated.mimeType !== "application/pdf") {
    return failure("선택한 파일이 PDF인지 확인해 주세요.");
  }

  let submission;
  try {
    submission = await getOrCreateSubmission({
      studentId: parsed.data.studentId,
      activityAssignmentId: parsed.data.activityAssignmentId,
    });
  } catch {
    return failure("선택한 학생과 활동 배정의 연결을 확인해 주세요.");
  }

  const artifactId = crypto.randomUUID();
  const storagePath = STORAGE.submissionOriginalPath(
    teacher.id,
    submission.id,
    artifactId,
    validated.extension,
  );
  const checksum = createHash("sha256").update(validated.bytes).digest("hex");
  const { error: storageError } = await supabase.storage
    .from(STORAGE.BUCKET)
    .upload(storagePath, validated.bytes, {
      contentType: validated.mimeType,
      upsert: false,
    });
  if (storageError) {
    console.error("Teacher ORIGINAL Storage upload failed", { artifactId, submissionId: submission.id });
    return failure("비공개 저장소에 파일을 올리지 못했어요. 잠시 후 다시 시도해 주세요.");
  }

  const { data: recordedId, error: recordError } = await supabase.rpc("record_teacher_artifact_upload", {
    p_submission_id: submission.id,
    p_artifact_id: artifactId,
    p_storage_path: storagePath,
    p_file_name: validated.fileName,
    p_mime_type: validated.mimeType,
    p_file_size_bytes: validated.fileSizeBytes,
    p_checksum: checksum,
    p_attempt_no: submission.currentAttemptNo,
  });
  if (recordError || recordedId !== artifactId) {
    const { error: cleanupError } = await supabase.storage.from(STORAGE.BUCKET).remove([storagePath]);
    console.error("Teacher Artifact DB record failed after Storage success", {
      artifactId,
      submissionId: submission.id,
      cleanupFailed: Boolean(cleanupError),
    });
    return failure("파일 관계를 저장하지 못했어요. 저장된 파일은 정리했으니 다시 시도해 주세요.");
  }

  const { data: artifact, error: readError } = await supabase
    .from("artifacts")
    .select("id, submission_id, artifact_role, storage_path")
    .eq("id", artifactId)
    .eq("submission_id", submission.id)
    .eq("artifact_role", "ORIGINAL")
    .maybeSingle();
  if (readError || !artifact || artifact.storage_path !== storagePath) {
    return failure("업로드는 완료됐지만 결과를 다시 읽지 못했어요. 새로고침 후 확인해 주세요.");
  }

  revalidatePath("/results/upload");
  revalidatePath("/results");
  return {
    ok: true,
    message: validated.pageCount === null
      ? "원본 이미지를 안전하게 저장했어요."
      : `원본 PDF ${validated.pageCount}쪽을 안전하게 저장했어요.`,
    artifactId,
  };
}

export type ArtifactSignedUrlResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

export async function createTeacherArtifactSignedUrl(artifactId: string): Promise<ArtifactSignedUrlResult> {
  if (!z.string().uuid().safeParse(artifactId).success) {
    return { ok: false, message: "파일 식별자를 확인해 주세요." };
  }
  try {
    await requireTeacherOwnership("artifact", artifactId);
  } catch {
    return { ok: false, message: "파일을 열 권한이 없어요." };
  }

  const { supabase } = await requireSessionTeacher();
  const { data: artifact, error: readError } = await supabase
    .from("artifacts")
    .select("storage_path")
    .eq("id", artifactId)
    .eq("artifact_role", "ORIGINAL")
    .maybeSingle();
  if (readError || !artifact) return { ok: false, message: "원본 파일을 찾지 못했어요." };

  const { data, error } = await supabase.storage
    .from(STORAGE.BUCKET)
    .createSignedUrl(artifact.storage_path, 300);
  if (error || !data?.signedUrl) return { ok: false, message: "미리보기 링크를 만들지 못했어요." };
  return { ok: true, url: data.signedUrl };
}
