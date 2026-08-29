import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { StructuredInputRuntimeSchema } from "../src/features/submissions/structured-input-schema.ts";
import {
  buildSyntheticStructuredInput,
  DEMO_HISTORY_ACTIVITIES,
  LIVE_DEMO_STUDENT_NUMBERS,
} from "./demo-history-fixtures.mjs";

function requiredEnv(name, fallbacks = []) {
  for (const key of [name, ...fallbacks]) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  throw new Error(`${name} is required for the server-only demo seed`);
}

function activityKeyFromArgs() {
  const raw = process.argv.find((value) => value.startsWith("--activity="))?.split("=")[1] ?? "";
  if (!Object.hasOwn(DEMO_HISTORY_ACTIVITIES, raw)) {
    throw new Error("Use exactly one of --activity=a1, --activity=a2, or --activity=a3. a4 is intentionally unsupported.");
  }
  return raw;
}

function oneRow(rows, label) {
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error(`${label} must resolve to exactly one row; found ${rows?.length ?? 0}`);
  }
  return rows[0];
}

async function findDemoClass(supabase) {
  const { data: classes, error: classError } = await supabase
    .from("classes")
    .select("id, teacher_id, grade, is_active")
    .eq("is_active", true);
  if (classError) throw new Error("Could not read Demo Class candidates", { cause: classError });

  const classIds = (classes ?? []).map((item) => item.id);
  if (classIds.length === 0) throw new Error("No active Class exists");
  const { data: students, error: studentError } = await supabase
    .from("students")
    .select("id, class_id, student_number, is_active")
    .in("class_id", classIds)
    .eq("is_active", true);
  if (studentError) throw new Error("Could not read Demo Roster", { cause: studentError });

  const candidates = (classes ?? []).filter((classItem) => (
    (students ?? []).filter((student) => student.class_id === classItem.id).length === 20
  ));
  const classItem = oneRow(candidates, "20-Student Demo Class");
  const roster = (students ?? [])
    .filter((student) => student.class_id === classItem.id)
    .sort((left, right) => left.student_number - right.student_number);
  assert.deepEqual(roster.map((student) => student.student_number), Array.from({ length: 20 }, (_, index) => index + 1));
  return { classItem, roster };
}

async function findActivity(supabase, teacherId, config) {
  const { data, error } = await supabase
    .from("activities")
    .select("id, title, activity_code, subject, domain, parent_activity_id, content_json, status")
    .eq("teacher_id", teacherId)
    .ilike("title", `%${config.titleIncludes}%`);
  if (error) throw new Error(`Could not read ${config.key} Activity`, { cause: error });
  const activity = oneRow(data, `${config.key} Activity`);
  if (activity.status !== "ACTIVE") throw new Error(`${config.key} Activity must be ACTIVE`);
  return activity;
}

async function findAssignment(supabase, activityId, classId) {
  const { data, error } = await supabase
    .from("activity_assignments")
    .select("id, status")
    .eq("activity_id", activityId)
    .eq("class_id", classId);
  if (error) throw new Error("Could not read ActivityAssignment", { cause: error });
  return oneRow(data, "ActivityAssignment");
}

async function assertPreviousLessonComplete(supabase, teacherId, classId, config) {
  if (!config.previousKey) return null;
  const previousConfig = DEMO_HISTORY_ACTIVITIES[config.previousKey];
  const previousActivity = await findActivity(supabase, teacherId, previousConfig);
  const previousAssignment = await findAssignment(supabase, previousActivity.id, classId);
  const { count, error } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("activity_assignment_id", previousAssignment.id)
    .eq("input_status", "READY_FOR_PROCESS");
  if (error) throw new Error(`Could not verify ${config.previousKey} completion`, { cause: error });
  if (count !== 20) throw new Error(`${config.previousKey} must have 20 READY_FOR_PROCESS Submissions before ${config.key}`);
  return previousActivity;
}

async function assertRealPdfSubmissions(supabase, assignmentId, roster, config) {
  const reservedStudents = roster.filter((student) => LIVE_DEMO_STUDENT_NUMBERS.has(student.student_number));
  const { data: submissions, error } = await supabase
    .from("submissions")
    .select("id, student_id, input_status, structured_input")
    .eq("activity_assignment_id", assignmentId)
    .in("student_id", reservedStudents.map((student) => student.id));
  if (error) throw new Error(`Could not verify real ${config.key} Submissions`, { cause: error });
  if ((submissions ?? []).length !== 2) {
    throw new Error(`${config.key} must be uploaded first through the real Batch PDF path for the two reserved Students`);
  }
  for (const submission of submissions ?? []) {
    if (submission.input_status !== "READY_FOR_PROCESS") {
      throw new Error(`${config.key} real PDF Submission is not READY_FOR_PROCESS`);
    }
    StructuredInputRuntimeSchema.parse(submission.structured_input);
  }

  const { data: artifacts, error: artifactError } = await supabase
    .from("artifacts")
    .select("submission_id, source_artifact_id, artifact_role, checksum")
    .in("submission_id", (submissions ?? []).map((submission) => submission.id));
  if (artifactError) throw new Error(`Could not verify real ${config.key} Artifact references`, { cause: artifactError });
  if ((artifacts ?? []).length < 2) throw new Error(`${config.key} real PDF Submissions need Artifact references`);

  const sourceIds = [...new Set((artifacts ?? []).map((artifact) => artifact.source_artifact_id).filter(Boolean))];
  const directChecksums = (artifacts ?? []).map((artifact) => artifact.checksum).filter(Boolean);
  let sourceChecksums = [];
  if (sourceIds.length > 0) {
    const { data: sources, error: sourceError } = await supabase
      .from("artifacts")
      .select("id, checksum, file_name")
      .in("id", sourceIds);
    if (sourceError) throw new Error(`Could not verify real ${config.key} Batch source`, { cause: sourceError });
    sourceChecksums = (sources ?? []).map((source) => source.checksum).filter(Boolean);
  }
  const checksums = [...new Set([...sourceChecksums, ...directChecksums])];
  if (!checksums.includes(config.sourceChecksum)) {
    throw new Error(`${config.key} source checksum does not match ${config.sourceFile}`);
  }
}

async function seedSyntheticSubmission({ supabase, teacherId, assignmentId, student, config }) {
  const { data: existing, error: existingError } = await supabase
    .from("submissions")
    .select("id, input_status, structured_input")
    .eq("student_id", student.id)
    .eq("activity_assignment_id", assignmentId)
    .maybeSingle();
  if (existingError) throw new Error("Could not check existing synthetic Submission", { cause: existingError });
  if (existing) {
    if (existing.input_status !== "READY_FOR_PROCESS") throw new Error("Existing synthetic Submission is not READY_FOR_PROCESS");
    StructuredInputRuntimeSchema.parse(existing.structured_input);
    return { created: false, submissionId: existing.id };
  }

  const structuredInput = StructuredInputRuntimeSchema.parse(
    buildSyntheticStructuredInput(config.key, student.student_number),
  );
  const artifactId = randomUUID();
  const submissionId = randomUUID();
  const storagePath = `teachers/${teacherId}/demo-history/${randomUUID()}/original/${artifactId}.json`;
  const bytes = Buffer.from(JSON.stringify({
    schema_version: "1",
    artifact_kind: "SYNTHETIC_OBSERVABLE_RESPONSE",
    activity_key: config.key,
    structured_input: structuredInput,
  }), "utf8");
  const checksum = createHash("sha256").update(bytes).digest("hex");

  const { error: uploadError } = await supabase.storage
    .from("trace")
    .upload(storagePath, bytes, { contentType: "application/json", upsert: false });
  if (uploadError) throw new Error("Synthetic private Artifact upload failed", { cause: uploadError });

  let submissionInserted = false;
  try {
    const { error: submissionError } = await supabase.from("submissions").insert({
      id: submissionId,
      student_id: student.id,
      activity_assignment_id: assignmentId,
      structured_input: structuredInput,
      input_status: "STORED",
      process_status: "NOT_STARTED",
      current_attempt_no: 1,
    });
    if (submissionError) throw new Error("Synthetic Submission insert failed", { cause: submissionError });
    submissionInserted = true;

    const { error: artifactError } = await supabase.from("artifacts").insert({
      id: artifactId,
      submission_id: submissionId,
      owner_teacher_id: null,
      source_artifact_id: null,
      storage_path: storagePath,
      file_name: `${config.key}-synthetic-observable-response.json`,
      mime_type: "application/json",
      file_size_bytes: bytes.byteLength,
      checksum,
      artifact_role: "ORIGINAL",
      attempt_no: 1,
    });
    if (artifactError) throw new Error("Synthetic Artifact record insert failed", { cause: artifactError });

    const { error: readyError } = await supabase.from("submissions").update({
      input_status: "READY_FOR_PROCESS",
      process_status: "READY_TO_ANALYZE",
      submitted_at: new Date().toISOString(),
    }).eq("id", submissionId);
    if (readyError) throw new Error("Synthetic Submission READY transition failed", { cause: readyError });

    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_teacher_id: teacherId,
      action: "ARTIFACT_UPLOAD",
      entity_type: "Artifact",
      entity_id: artifactId,
      request_id: randomUUID(),
      metadata_json: null,
    });
    if (auditError) throw new Error("Synthetic Artifact audit insert failed", { cause: auditError });
  } catch (error) {
    if (submissionInserted) await supabase.from("submissions").delete().eq("id", submissionId);
    await supabase.storage.from("trace").remove([storagePath]);
    throw error;
  }

  return { created: true, submissionId };
}

async function main() {
  const activityKey = activityKeyFromArgs();
  const config = DEMO_HISTORY_ACTIVITIES[activityKey];
  const supabaseUrl = requiredEnv("SUPABASE_URL", ["NEXT_PUBLIC_SUPABASE_URL"]);
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { classItem, roster } = await findDemoClass(supabase);
  const activity = await findActivity(supabase, classItem.teacher_id, config);
  if (
    activity.subject !== config.subject
    || activity.domain !== config.domain
    || activity.activity_code !== config.activityCode
  ) {
    const { error: curriculumError } = await supabase
      .from("activities")
      .update({
        subject: config.subject,
        domain: config.domain,
        activity_code: config.activityCode,
      })
      .eq("id", activity.id)
      .eq("teacher_id", classItem.teacher_id);
    if (curriculumError) throw new Error(`${config.key} subject/domain update failed`, { cause: curriculumError });
  }
  const { error: removeStandardsError } = await supabase
    .from("activity_standards")
    .delete()
    .eq("activity_id", activity.id)
    .neq("standard_id", config.standardId);
  if (removeStandardsError) throw new Error(`${config.key} old standard cleanup failed`, { cause: removeStandardsError });
  const { error: standardError } = await supabase
    .from("activity_standards")
    .upsert({ activity_id: activity.id, standard_id: config.standardId }, { onConflict: "activity_id,standard_id" });
  if (standardError) throw new Error(`${config.key} reading standard update failed`, { cause: standardError });
  const assignment = await findAssignment(supabase, activity.id, classItem.id);
  const previousActivity = await assertPreviousLessonComplete(
    supabase,
    classItem.teacher_id,
    classItem.id,
    config,
  );

  if (previousActivity) {
    if (activity.parent_activity_id && activity.parent_activity_id !== previousActivity.id) {
      throw new Error(`${config.key} already points to a different parent Activity`);
    }
    const { error: parentError } = await supabase
      .from("activities")
      .update({ parent_activity_id: previousActivity.id })
      .eq("id", activity.id)
      .eq("teacher_id", classItem.teacher_id);
    if (parentError) throw new Error(`${config.key} parent Activity update failed`, { cause: parentError });
  }

  await assertRealPdfSubmissions(supabase, assignment.id, roster, config);

  let created = 0;
  let reused = 0;
  const seededSubmissionIds = [];
  const syntheticStudents = roster.filter(
    (student) => !LIVE_DEMO_STUDENT_NUMBERS.has(student.student_number),
  );
  for (let offset = 0; offset < syntheticStudents.length; offset += 6) {
    const chunk = syntheticStudents.slice(offset, offset + 6);
    const results = await Promise.all(chunk.map((student) => seedSyntheticSubmission({
      supabase,
      teacherId: classItem.teacher_id,
      assignmentId: assignment.id,
      student,
      config,
    })));
    for (const result of results) {
      if (result.created) created += 1;
      else reused += 1;
      seededSubmissionIds.push(result.submissionId);
    }
  }

  const { data: finalSubmissions, error: finalError } = await supabase
    .from("submissions")
    .select("id, input_status")
    .eq("activity_assignment_id", assignment.id);
  if (finalError) throw new Error("Final Submission verification failed", { cause: finalError });
  const readyCount = (finalSubmissions ?? []).filter((item) => item.input_status === "READY_FOR_PROCESS").length;
  if ((finalSubmissions ?? []).length !== 20 || readyCount !== 20) {
    throw new Error(`${config.key} verification failed: expected 20/20 READY_FOR_PROCESS`);
  }

  console.log(JSON.stringify({
    activityKey,
    activityId: activity.id,
    subject: config.subject,
    domain: config.domain,
    standardId: config.standardId,
    activityCode: config.activityCode,
    assignmentId: assignment.id,
    parentActivityId: previousActivity?.id ?? null,
    sourceChecksumVerified: true,
    realPdfSubmissionCount: 2,
    syntheticCreated: created,
    syntheticReused: reused,
    totalSubmissionCount: finalSubmissions.length,
    readyForProcessCount: readyCount,
    seededSubmissionIds,
    a4Touched: false,
  }, null, 2));
}

await main();
