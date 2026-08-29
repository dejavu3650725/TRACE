"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacherOwnership } from "@/lib/auth/ownership";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { STORAGE } from "@/lib/config";
import {
  BatchPageRangeValidationError,
  normalizeBatchPageRanges,
  type BatchPageRange,
} from "./batch-ranges";
import {
  ArtifactFileValidationError,
  validateTeacherArtifactFile,
} from "./validation";

export type BatchPdfUploadResult =
  | { ok: true; artifactId: string; pageCount: number; message: string }
  | { ok: false; message: string };

export async function uploadTeacherBatchPdf(formData: FormData): Promise<BatchPdfUploadResult> {
  const { teacher, supabase } = await requireSessionTeacher();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "PDF 파일을 다시 선택해 주세요." };

  let validated;
  try {
    validated = await validateTeacherArtifactFile(file);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ArtifactFileValidationError
        ? error.message
        : "PDF 파일을 검증하지 못했어요.",
    };
  }
  if (validated.mimeType !== "application/pdf" || validated.pageCount === null) {
    return { ok: false, message: "Batch 자료는 PDF 한 파일로 올려 주세요." };
  }

  const artifactId = crypto.randomUUID();
  const storagePath = STORAGE.teacherBatchOriginalPath(teacher.id, artifactId);
  const checksum = createHash("sha256").update(validated.bytes).digest("hex");
  const { error: storageError } = await supabase.storage
    .from(STORAGE.BUCKET)
    .upload(storagePath, validated.bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (storageError) {
    console.error("Teacher Batch PDF Storage upload failed", { artifactId });
    return { ok: false, message: "비공개 저장소에 Batch PDF를 올리지 못했어요." };
  }

  const { data: recordedId, error: recordError } = await supabase.rpc("record_teacher_batch_pdf", {
    p_artifact_id: artifactId,
    p_storage_path: storagePath,
    p_file_name: validated.fileName,
    p_file_size_bytes: validated.fileSizeBytes,
    p_checksum: checksum,
    p_page_count: validated.pageCount,
  });
  if (recordError || recordedId !== artifactId) {
    const { error: cleanupError } = await supabase.storage.from(STORAGE.BUCKET).remove([storagePath]);
    console.error("Teacher Batch PDF DB record failed after Storage success", {
      artifactId,
      cleanupFailed: Boolean(cleanupError),
    });
    return { ok: false, message: "PDF 관계를 저장하지 못했어요. 원본 파일을 정리했으니 다시 시도해 주세요." };
  }

  const { data: artifact, error: readError } = await supabase
    .from("artifacts")
    .select("id, owner_teacher_id, submission_id, artifact_role, page_start, page_end, storage_path")
    .eq("id", artifactId)
    .maybeSingle();
  if (
    readError
    || !artifact
    || artifact.owner_teacher_id !== teacher.id
    || artifact.submission_id !== null
    || artifact.artifact_role !== "ORIGINAL"
    || artifact.page_start !== 1
    || artifact.page_end !== validated.pageCount
    || artifact.storage_path !== storagePath
  ) {
    return { ok: false, message: "원본은 저장됐지만 페이지 정보를 다시 읽지 못했어요." };
  }

  revalidatePath("/results/upload");
  return {
    ok: true,
    artifactId,
    pageCount: validated.pageCount,
    message: `${validated.pageCount}쪽 Batch PDF 원본을 한 번만 저장했어요.`,
  };
}

const saveRangesSchema = z.object({
  sourceArtifactId: z.string().uuid(),
  pageCount: z.number().int().min(1).max(100),
  ranges: z.array(z.object({
    page_start: z.number(),
    page_end: z.number(),
  })).min(1).max(100),
});

export type SaveBatchRangesResult =
  | { ok: true; ranges: (BatchPageRange & { id: string })[]; message: string }
  | { ok: false; message: string };

export async function replaceTeacherBatchPageRanges(input: {
  sourceArtifactId: string;
  pageCount: number;
  ranges: BatchPageRange[];
}): Promise<SaveBatchRangesResult> {
  const parsed = saveRangesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "페이지 구간 입력을 다시 확인해 주세요." };
  try {
    await requireTeacherOwnership("artifact", parsed.data.sourceArtifactId);
  } catch {
    return { ok: false, message: "이 Batch PDF를 수정할 권한이 없어요." };
  }

  let ranges: BatchPageRange[];
  try {
    ranges = normalizeBatchPageRanges(parsed.data.ranges, parsed.data.pageCount);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof BatchPageRangeValidationError
        ? error.message
        : "페이지 구간을 검증하지 못했어요.",
    };
  }

  const { supabase } = await requireSessionTeacher();
  const { data, error } = await supabase.rpc("replace_teacher_batch_page_ranges", {
    p_source_artifact_id: parsed.data.sourceArtifactId,
    p_ranges: ranges,
  });
  if (error || !Array.isArray(data)) {
    return { ok: false, message: "페이지 구간을 저장하지 못했어요." };
  }

  const resultSchema = z.array(z.object({
    id: z.string().uuid(),
    page_start: z.number().int(),
    page_end: z.number().int(),
  }));
  const result = resultSchema.safeParse(data);
  if (!result.success) return { ok: false, message: "저장 결과를 다시 읽지 못했어요." };

  revalidatePath(`/results/upload/batches/${parsed.data.sourceArtifactId}`);
  return {
    ok: true,
    ranges: result.data,
    message: `${result.data.length}개 페이지 구간을 저장했어요.`,
  };
}
