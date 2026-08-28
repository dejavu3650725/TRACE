import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { STORAGE } from "../src/lib/config.ts";
import { validateTeacherArtifactFile } from "../src/features/artifacts/validation.ts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const hostname = supabaseUrl ? new URL(supabaseUrl).hostname : "";
if (!anonKey || !["127.0.0.1", "localhost"].includes(hostname)) {
  throw new Error("This smoke test requires an explicitly configured local Supabase URL and anon key");
}

const unique = randomUUID();
const supabase = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: authData, error: authError } = await supabase.auth.signUp({
  email: `batch-${unique}@example.test`,
  password: `Synthetic-${unique}-Pass1!`,
});
assert.ifError(authError);
assert.ok(authData.user && authData.session);

const { data: teacher, error: teacherError } = await supabase
  .from("teachers")
  .insert({ auth_user_id: authData.user.id, name: "Synthetic Batch Storage Teacher" })
  .select("id")
  .single();
assert.ifError(teacherError);

const samplePath = new URL("../output/pdf/issue-28-synthetic-batch.pdf", import.meta.url);
const bytes = new Uint8Array(await readFile(samplePath));
const validated = await validateTeacherArtifactFile({
  name: "issue-28-synthetic-batch.pdf",
  size: bytes.byteLength,
  async arrayBuffer() {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  },
});
assert.equal(validated.pageCount, 12);

const artifactId = randomUUID();
const storagePath = STORAGE.teacherBatchOriginalPath(teacher.id, artifactId);
const { error: uploadError } = await supabase.storage.from(STORAGE.BUCKET).upload(
  storagePath,
  bytes,
  { contentType: "application/pdf", upsert: false },
);
assert.ifError(uploadError);
const checksum = createHash("sha256").update(bytes).digest("hex");
const { data: recordedId, error: recordError } = await supabase.rpc("record_teacher_batch_pdf", {
  p_artifact_id: artifactId,
  p_storage_path: storagePath,
  p_file_name: validated.fileName,
  p_file_size_bytes: validated.fileSizeBytes,
  p_checksum: checksum,
  p_page_count: validated.pageCount,
});
assert.ifError(recordError);
assert.equal(recordedId, artifactId);

const expectedRanges = [
  { page_start: 1, page_end: 2 },
  { page_start: 3, page_end: 3 },
  { page_start: 4, page_end: 6 },
  { page_start: 7, page_end: 8 },
  { page_start: 9, page_end: 9 },
  { page_start: 10, page_end: 12 },
];
const { data: savedRanges, error: rangeError } = await supabase.rpc(
  "replace_teacher_batch_page_ranges",
  { p_source_artifact_id: artifactId, p_ranges: expectedRanges },
);
assert.ifError(rangeError);
assert.equal(savedRanges.length, 6);

const { data: root, error: rootError } = await supabase
  .from("artifacts")
  .select("id, owner_teacher_id, submission_id, artifact_role, page_start, page_end, storage_path")
  .eq("id", artifactId)
  .single();
assert.ifError(rootError);
assert.deepEqual(root, {
  id: artifactId,
  owner_teacher_id: teacher.id,
  submission_id: null,
  artifact_role: "ORIGINAL",
  page_start: 1,
  page_end: 12,
  storage_path: storagePath,
});
const { data: ranges, error: reloadError } = await supabase
  .from("artifacts")
  .select("page_start, page_end, storage_path, source_artifact_id")
  .eq("source_artifact_id", artifactId)
  .order("page_start");
assert.ifError(reloadError);
assert.deepEqual(ranges.map(({ page_start, page_end }) => ({ page_start, page_end })), expectedRanges);
assert.equal(new Set(ranges.map((range) => range.storage_path)).size, 1);

const { data: signed, error: signedError } = await supabase.storage
  .from(STORAGE.BUCKET)
  .createSignedUrl(storagePath, 60);
assert.ifError(signedError);
const response = await fetch(signed.signedUrl);
assert.equal(response.ok, true);
assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);

const { error: overwriteError } = await supabase.storage.from(STORAGE.BUCKET).upload(
  storagePath,
  bytes,
  { contentType: "application/pdf", upsert: false },
);
assert.ok(overwriteError);

console.log("batch-pdf-storage-local smoke: ok");
