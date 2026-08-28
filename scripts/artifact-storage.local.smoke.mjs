import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
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
  email: `artifact-${unique}@example.test`,
  password: `Synthetic-${unique}-Pass1!`,
});
assert.ifError(authError);
assert.ok(authData.user && authData.session, "local synthetic user should receive a session");

const { data: teacher, error: teacherError } = await supabase
  .from("teachers")
  .insert({ auth_user_id: authData.user.id, name: "Synthetic Storage Teacher" })
  .select("id")
  .single();
assert.ifError(teacherError);

const { data: classItem, error: classError } = await supabase
  .from("classes")
  .insert({ teacher_id: teacher.id, name: "Synthetic Storage Class", grade: 3 })
  .select("id")
  .single();
assert.ifError(classError);
const { data: student, error: studentError } = await supabase
  .from("students")
  .insert({ class_id: classItem.id, student_number: 1, name: "Synthetic Storage Student" })
  .select("id")
  .single();
assert.ifError(studentError);
const { data: activity, error: activityError } = await supabase
  .from("activities")
  .insert({ teacher_id: teacher.id, title: "Synthetic Storage Activity", status: "ACTIVE" })
  .select("id")
  .single();
assert.ifError(activityError);
const { data: assignment, error: assignmentError } = await supabase
  .from("activity_assignments")
  .insert({ activity_id: activity.id, class_id: classItem.id, status: "OPEN" })
  .select("id")
  .single();
assert.ifError(assignmentError);

const { data: submissionId, error: submissionError } = await supabase.rpc("get_or_create_submission", {
  p_student_id: student.id,
  p_activity_assignment_id: assignment.id,
});
assert.ifError(submissionError);
assert.ok(submissionId);

const sampleBytes = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
));
const validated = await validateTeacherArtifactFile({
  name: "synthetic-original.png",
  size: sampleBytes.byteLength,
  async arrayBuffer() {
    return sampleBytes.buffer.slice(sampleBytes.byteOffset, sampleBytes.byteOffset + sampleBytes.byteLength);
  },
});
const artifactId = randomUUID();
const storagePath = STORAGE.submissionOriginalPath(
  teacher.id,
  submissionId,
  artifactId,
  validated.extension,
);
const { error: uploadError } = await supabase.storage.from(STORAGE.BUCKET).upload(
  storagePath,
  validated.bytes,
  { contentType: validated.mimeType, upsert: false },
);
assert.ifError(uploadError);

const checksum = createHash("sha256").update(validated.bytes).digest("hex");
const { data: recordedId, error: recordError } = await supabase.rpc("record_teacher_artifact_upload", {
  p_submission_id: submissionId,
  p_artifact_id: artifactId,
  p_storage_path: storagePath,
  p_file_name: validated.fileName,
  p_mime_type: validated.mimeType,
  p_file_size_bytes: validated.fileSizeBytes,
  p_checksum: checksum,
  p_attempt_no: 1,
});
assert.ifError(recordError);
assert.equal(recordedId, artifactId);

const { data: artifact, error: artifactError } = await supabase
  .from("artifacts")
  .select("id, submission_id, artifact_role, checksum")
  .eq("id", artifactId)
  .single();
assert.ifError(artifactError);
assert.deepEqual(artifact, {
  id: artifactId,
  submission_id: submissionId,
  artifact_role: "ORIGINAL",
  checksum,
});
const { data: submission, error: reloadError } = await supabase
  .from("submissions")
  .select("input_status, process_status")
  .eq("id", submissionId)
  .single();
assert.ifError(reloadError);
assert.deepEqual(submission, { input_status: "STORED", process_status: "NOT_STARTED" });
const { count: auditCount, error: auditError } = await supabase
  .from("audit_logs")
  .select("id", { count: "exact", head: true })
  .eq("action", "ARTIFACT_UPLOAD")
  .eq("entity_id", artifactId)
  .is("metadata_json", null);
assert.ifError(auditError);
assert.equal(auditCount, 1);

const { data: signed, error: signedError } = await supabase.storage
  .from(STORAGE.BUCKET)
  .createSignedUrl(storagePath, 60);
assert.ifError(signedError);
assert.ok(signed?.signedUrl);
const downloaded = new Uint8Array(await (await fetch(signed.signedUrl)).arrayBuffer());
assert.deepEqual(downloaded, validated.bytes);

const { error: overwriteError } = await supabase.storage.from(STORAGE.BUCKET).upload(
  storagePath,
  validated.bytes,
  { contentType: validated.mimeType, upsert: false },
);
assert.ok(overwriteError, "a duplicate object key must not overwrite the ORIGINAL");

console.log("artifact-storage-local smoke: ok");
