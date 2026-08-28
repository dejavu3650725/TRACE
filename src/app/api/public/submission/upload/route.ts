import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FILE_LIMITS, STORAGE } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ISSUE-19 — 학생 사진 업로드 (검증 세션 필수)
 * - submission_id + session_code(검증 API가 발급)로만 접근
 * - Storage Key는 UUID 기반, URL/키에 PII 없음 (TRD §30.9)
 * - 이미지 10MB 제한, 다른 Submission 접근 불가
 */

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

async function authorize(supabase: ReturnType<typeof createAdminClient>, submissionId: string, sessionCode: string) {
  if (!submissionId || !sessionCode) return null;
  const { data: submission } = await supabase
    .from("submissions")
    .select(
      `id, submission_code, current_attempt_no,
       activity_assignments ( id, status, classes ( teacher_id ) )`,
    )
    .eq("id", submissionId)
    .maybeSingle();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  const assignment = submission ? one(submission.activity_assignments) : null;
  if (!submission || submission.submission_code !== sessionCode) return null;
  if (!assignment || assignment.status !== "OPEN") return null;
  const teacherId = one(assignment.classes)?.teacher_id as string | undefined;
  if (!teacherId) return null;
  return { submission, teacherId };
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, message: "잘못된 요청이에요." }, { status: 400 });

  const submissionId = String(form.get("submission_id") ?? "");
  const sessionCode = String(form.get("session_code") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "업로드할 사진이 없어요." }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ ok: false, message: "사진 파일(JPG/PNG/WEBP/HEIC)만 올릴 수 있어요." }, { status: 400 });
  }
  if (file.size > FILE_LIMITS.IMAGE_MAX_BYTES) {
    return NextResponse.json({ ok: false, message: "사진 한 장은 10MB 이하여야 해요." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const auth = await authorize(supabase, submissionId, sessionCode);
  if (!auth) {
    return NextResponse.json({ ok: false, message: "제출 세션이 만료됐어요. 처음부터 다시 확인해 주세요." }, { status: 403 });
  }

  const artifactUuid = randomUUID();
  const ext = EXT_BY_MIME[file.type] ?? "jpg";
  const storagePath = STORAGE.submissionOriginalPath(auth.teacherId, submissionId, artifactUuid, ext);

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(STORAGE.BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error("[public-upload] storage error", uploadError.message);
    return NextResponse.json({ ok: false, message: "업로드에 실패했어요. 다시 시도해 주세요." }, { status: 500 });
  }

  const { data: artifact, error: insertError } = await supabase
    .from("artifacts")
    .insert({
      submission_id: submissionId,
      storage_path: storagePath,
      file_name: `${artifactUuid}.${ext}`, // 원본 파일명 저장 금지 (PII 가능성)
      mime_type: file.type,
      file_size_bytes: file.size,
      artifact_role: "ORIGINAL",
      attempt_no: auth.submission.current_attempt_no ?? 1,
    })
    .select("id")
    .single();
  if (insertError || !artifact) {
    await supabase.storage.from(STORAGE.BUCKET).remove([storagePath]);
    return NextResponse.json({ ok: false, message: "업로드 기록에 실패했어요. 다시 시도해 주세요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, artifact_id: artifact.id });
}

/** 재촬영 등으로 학생이 방금 올린 사진을 제거 */
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const submissionId = String(body?.submission_id ?? "");
  const sessionCode = String(body?.session_code ?? "");
  const artifactId = String(body?.artifact_id ?? "");
  const supabase = createAdminClient();
  const auth = await authorize(supabase, submissionId, sessionCode);
  if (!auth || !artifactId) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const { data: artifact } = await supabase
    .from("artifacts")
    .select("id, storage_path, submission_id")
    .eq("id", artifactId)
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (!artifact) return NextResponse.json({ ok: false }, { status: 404 });
  await supabase.storage.from(STORAGE.BUCKET).remove([artifact.storage_path]);
  await supabase.from("artifacts").delete().eq("id", artifact.id);
  return NextResponse.json({ ok: true });
}
