import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { AiActivityDraftSchema, activityContentFromAiDraft } from "../src/features/activities/ai-schema.ts";
import { StructuredInputRuntimeSchema } from "../src/features/submissions/structured-input-schema.ts";
import { DEMO_HISTORY_ACTIVITIES } from "./demo-history-fixtures.mjs";

const config = DEMO_HISTORY_ACTIVITIES.a3;

function requiredEnv(name, fallbacks = []) {
  for (const key of [name, ...fallbacks]) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  throw new Error(`${name} is required for A3 bootstrap`);
}

function oneRow(rows, label) {
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error(`${label} must resolve to exactly one row; found ${rows?.length ?? 0}`);
  }
  return rows[0];
}

async function findDemoContext(supabase) {
  const { data: classes, error: classError } = await supabase
    .from("classes")
    .select("id, teacher_id, grade")
    .eq("is_active", true);
  if (classError) throw new Error("Could not read Demo Class candidates", { cause: classError });
  const { data: students, error: studentError } = await supabase
    .from("students")
    .select("id, class_id, student_number, name")
    .in("class_id", (classes ?? []).map((item) => item.id))
    .eq("is_active", true);
  if (studentError) throw new Error("Could not read Demo Roster", { cause: studentError });
  const classItem = oneRow((classes ?? []).filter((item) => (
    (students ?? []).filter((student) => student.class_id === item.id).length === 20
  )), "20-Student Demo Class");
  const roster = (students ?? [])
    .filter((student) => student.class_id === classItem.id)
    .sort((left, right) => left.student_number - right.student_number);
  assert.deepEqual(roster.map((student) => student.student_number), Array.from({ length: 20 }, (_, index) => index + 1));
  return { classItem, roster };
}

function a3Draft() {
  return AiActivityDraftSchema.parse({
    title: "문단 완성하기",
    description: "중심 문장에 어울리는 뒷받침 문장을 쓰고 하나의 문단을 완성한 뒤 스스로 점검하는 활동입니다.",
    instructions: "중심 문장과 뒷받침 문장을 갖추어 하나의 문단을 완성하고, 문단의 짜임을 스스로 확인합니다.",
    grade: 3,
    subject: config.subject,
    domain: config.domain,
    unit: "문단의 짜임",
    activity_type: "활동지",
    standard_candidates: [config.standardId],
    questions: [
      {
        question_id: "Q1",
        prompt: "주어진 중심 문장에 알맞은 뒷받침 문장을 2개 써 봅시다.",
        question_type: "LONG_TEXT",
        options: [],
      },
      {
        question_id: "Q2",
        prompt: "1번에서 쓴 내용을 바탕으로 하나의 문단을 완성해 봅시다.",
        question_type: "LONG_TEXT",
        options: [],
      },
      {
        question_id: "Q3",
        prompt: "문단을 다 쓴 뒤 중심 문장, 뒷받침 문장, 문장의 자연스러운 연결을 스스로 확인해 봅시다.",
        question_type: "MULTIPLE_CHOICE",
        options: [
          "중심 문장이 들어 있나요?",
          "중심 문장과 어울리는 뒷받침 문장이 있나요?",
          "문장이 자연스럽게 이어지나요?",
        ],
      },
    ],
    print_layout_data: { paper_size: "A4", orientation: "PORTRAIT", estimated_pages: 1 },
  });
}

function realA3Input(studentNumber) {
  if (studentNumber === 4) {
    return StructuredInputRuntimeSchema.parse({
      schema_version: "1",
      questions: [
        {
          question_id: "Q1",
          response_type: "long_text",
          response: { raw_text: "우리 반에는 좋은 점이 많습니다. / 우리 반에는 친구들이 친절합니다." },
        },
        {
          question_id: "Q2",
          response_type: "long_text",
          response: { raw_text: "우리 반에는 좋은 점이 많습니다. 우리 반에는 공부에 도움이 되는 책이 많습니다. 우리 반에는 친구들이 친절해서 서로서로 도와줍니다." },
        },
        {
          question_id: "Q3",
          response_type: "checkbox",
          response: { selected_options: ["중심 문장", "알맞은 뒷받침 문장", "자연스러운 연결"] },
        },
      ],
    });
  }
  if (studentNumber === 20) {
    return StructuredInputRuntimeSchema.parse({
      schema_version: "1",
      questions: [
        {
          question_id: "Q1",
          response_type: "long_text",
          response: { raw_text: "우리 반은 함께 즐겁게 놉니다. / 우리 반은 서로 잘 도와줍니다." },
        },
        {
          question_id: "Q2",
          response_type: "long_text",
          response: { raw_text: "우리 반에는 좋은 점이 있습니다. 우리 반은 함께 즐겁게 놉니다. 우리 반은 서로 잘 도와줍니다." },
        },
        {
          question_id: "Q3",
          response_type: "checkbox",
          response: { selected_options: ["중심 문장", "알맞은 뒷받침 문장", "자연스러운 연결"] },
        },
      ],
    });
  }
  throw new Error(`Student ${studentNumber} is not a real A3 PDF Student`);
}

async function completeExistingA3({ supabase, classItem, roster, activityId }) {
  const { data: assignments, error: assignmentError } = await supabase
    .from("activity_assignments")
    .select("id")
    .eq("activity_id", activityId)
    .eq("class_id", classItem.id);
  if (assignmentError) throw new Error("Could not read existing A3 Assignment", { cause: assignmentError });
  const assignment = oneRow(assignments, "Existing A3 Assignment");

  const { data: sources, error: sourceError } = await supabase
    .from("artifacts")
    .select("id, storage_path, file_name, mime_type, file_size_bytes, checksum")
    .eq("owner_teacher_id", classItem.teacher_id)
    .is("submission_id", null)
    .is("source_artifact_id", null)
    .eq("artifact_role", "ORIGINAL")
    .eq("checksum", config.sourceChecksum);
  if (sourceError) throw new Error("Could not read existing A3 Batch source", { cause: sourceError });
  const source = oneRow(sources, "Existing A3 Batch source");
  const realStudents = [4, 20].map((studentNumber) => {
    const student = roster.find((item) => item.student_number === studentNumber);
    if (!student) throw new Error(`A3 PDF Student ${studentNumber} is not in the Demo Roster`);
    return student;
  });
  const { data: submissions, error: submissionsError } = await supabase
    .from("submissions")
    .select("id, student_id, input_status")
    .eq("activity_assignment_id", assignment.id)
    .in("student_id", realStudents.map((student) => student.id));
  if (submissionsError) throw new Error("Could not read existing A3 real Submissions", { cause: submissionsError });

  const student4 = realStudents.find((student) => student.student_number === 4);
  const student20 = realStudents.find((student) => student.student_number === 20);
  const submission4 = (submissions ?? []).find((submission) => submission.student_id === student4.id);
  if (!submission4 || submission4.input_status !== "READY_FOR_PROCESS") {
    throw new Error("A3 Student 4 real PDF Submission must already be READY_FOR_PROCESS");
  }
  const { data: pageOneArtifacts, error: pageOneError } = await supabase
    .from("artifacts")
    .select("id, page_start, page_end")
    .eq("submission_id", submission4.id)
    .eq("source_artifact_id", source.id)
    .eq("artifact_role", "DERIVED");
  if (pageOneError) throw new Error("Could not read A3 Student 4 page Artifact", { cause: pageOneError });
  const pageOne = oneRow(pageOneArtifacts, "A3 Student 4 page Artifact");
  const originalPageEnd = pageOne.page_end;
  const { error: narrowError } = await supabase
    .from("artifacts")
    .update({ page_start: 1, page_end: 1 })
    .eq("id", pageOne.id);
  if (narrowError) throw new Error("A3 Student 4 page range correction failed", { cause: narrowError });

  let submission20 = (submissions ?? []).find((submission) => submission.student_id === student20.id);
  let createdSubmission20 = false;
  try {
    if (!submission20) {
      const submissionId = randomUUID();
      const { error: submissionError } = await supabase.from("submissions").insert({
        id: submissionId,
        student_id: student20.id,
        activity_assignment_id: assignment.id,
        structured_input: realA3Input(20),
        input_status: "READY_FOR_PROCESS",
        process_status: "READY_TO_ANALYZE",
        current_attempt_no: 1,
        submitted_at: new Date().toISOString(),
      });
      if (submissionError) throw new Error("A3 Student 20 Submission insert failed", { cause: submissionError });
      submission20 = { id: submissionId, student_id: student20.id, input_status: "READY_FOR_PROCESS" };
      createdSubmission20 = true;
    }
    const { data: existingPageTwo, error: existingPageTwoError } = await supabase
      .from("artifacts")
      .select("id")
      .eq("submission_id", submission20.id)
      .eq("source_artifact_id", source.id)
      .eq("artifact_role", "DERIVED");
    if (existingPageTwoError) throw new Error("Could not inspect A3 Student 20 page Artifact", { cause: existingPageTwoError });
    if ((existingPageTwo ?? []).length === 0) {
      const { error: rangeError } = await supabase.from("artifacts").insert({
        id: randomUUID(),
        submission_id: submission20.id,
        owner_teacher_id: null,
        source_artifact_id: source.id,
        storage_path: source.storage_path,
        file_name: source.file_name,
        mime_type: source.mime_type,
        file_size_bytes: source.file_size_bytes,
        checksum: source.checksum,
        artifact_role: "DERIVED",
        attempt_no: 1,
        page_start: 2,
        page_end: 2,
      });
      if (rangeError) throw new Error("A3 Student 20 page Artifact insert failed", { cause: rangeError });
    }
  } catch (error) {
    if (createdSubmission20 && submission20) await supabase.from("submissions").delete().eq("id", submission20.id);
    await supabase.from("artifacts").update({ page_start: 1, page_end: originalPageEnd }).eq("id", pageOne.id);
    throw error;
  }

  console.log(JSON.stringify({
    activityId,
    assignmentId: assignment.id,
    sourceArtifactId: source.id,
    subject: config.subject,
    domain: config.domain,
    standardId: config.standardId,
    activityCode: config.activityCode,
    realPdfSubmissionCount: 2,
    pageRanges: [{ studentNumber: 4, pageStart: 1, pageEnd: 1 }, { studentNumber: 20, pageStart: 2, pageEnd: 2 }],
    externalAiUsed: false,
    a4Touched: false,
  }, null, 2));
}

async function main() {
  const supabase = createClient(
    requiredEnv("SUPABASE_URL", ["NEXT_PUBLIC_SUPABASE_URL"]),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { classItem, roster } = await findDemoContext(supabase);
  const { data: existing, error: existingError } = await supabase
    .from("activities")
    .select("id")
    .eq("teacher_id", classItem.teacher_id)
    .ilike("title", `%${config.titleIncludes}%`);
  if (existingError) throw new Error("Could not inspect existing A3 Activity", { cause: existingError });
  if ((existing ?? []).length > 0) {
    await completeExistingA3({
      supabase,
      classItem,
      roster,
      activityId: oneRow(existing, "Existing A3 Activity").id,
    });
    return;
  }

  const { data: previousActivities, error: previousError } = await supabase
    .from("activities")
    .select("id")
    .eq("teacher_id", classItem.teacher_id)
    .ilike("title", `%${DEMO_HISTORY_ACTIVITIES.a2.titleIncludes}%`);
  if (previousError) throw new Error("Could not read A2 Activity", { cause: previousError });
  const previousActivity = oneRow(previousActivities, "A2 Activity");
  const { data: previousAssignments, error: previousAssignmentError } = await supabase
    .from("activity_assignments")
    .select("id")
    .eq("activity_id", previousActivity.id)
    .eq("class_id", classItem.id);
  if (previousAssignmentError) throw new Error("Could not read A2 Assignment", { cause: previousAssignmentError });
  const previousAssignment = oneRow(previousAssignments, "A2 Assignment");
  const { count: previousReady, error: previousReadyError } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("activity_assignment_id", previousAssignment.id)
    .eq("input_status", "READY_FOR_PROCESS");
  if (previousReadyError || previousReady !== 20) throw new Error("A2 must be 20/20 READY_FOR_PROCESS before A3");

  const pdf = await readFile(new URL(`../샘플 데이터/${config.sourceFile}`, import.meta.url));
  const checksum = createHash("sha256").update(pdf).digest("hex");
  assert.equal(checksum, config.sourceChecksum);
  const activityId = randomUUID();
  const assignmentId = randomUUID();
  const sourceArtifactId = randomUUID();
  const storagePath = `teachers/${classItem.teacher_id}/batches/${sourceArtifactId}/original/${sourceArtifactId}.pdf`;
  const createdSubmissionIds = [];
  let uploaded = false;
  let activityInserted = false;
  let sourceInserted = false;

  try {
    const { error: uploadError } = await supabase.storage.from("trace").upload(storagePath, pdf, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadError) throw new Error("A3 private PDF upload failed", { cause: uploadError });
    uploaded = true;

    const { error: sourceError } = await supabase.from("artifacts").insert({
      id: sourceArtifactId,
      submission_id: null,
      owner_teacher_id: classItem.teacher_id,
      source_artifact_id: null,
      storage_path: storagePath,
      file_name: config.sourceFile,
      mime_type: "application/pdf",
      file_size_bytes: pdf.byteLength,
      checksum,
      artifact_role: "ORIGINAL",
      attempt_no: 1,
      page_start: 1,
      page_end: 2,
    });
    if (sourceError) throw new Error("A3 Batch Artifact record failed", { cause: sourceError });
    sourceInserted = true;

    const draft = a3Draft();
    const { error: activityError } = await supabase.from("activities").insert({
      id: activityId,
      teacher_id: classItem.teacher_id,
      title: draft.title,
      grade: draft.grade,
      subject: draft.subject,
      domain: draft.domain,
      unit: draft.unit,
      activity_type: draft.activity_type,
      description: draft.description,
      content_json: activityContentFromAiDraft(draft),
      activity_code: config.activityCode,
      status: "ACTIVE",
      parent_activity_id: previousActivity.id,
    });
    if (activityError) throw new Error("A3 Activity insert failed", { cause: activityError });
    activityInserted = true;

    const { error: standardError } = await supabase.from("activity_standards").insert({
      activity_id: activityId,
      standard_id: config.standardId,
    });
    if (standardError) throw new Error("A3 reading Standard insert failed", { cause: standardError });
    const { error: assignmentError } = await supabase.from("activity_assignments").insert({
      id: assignmentId,
      activity_id: activityId,
      class_id: classItem.id,
      status: "OPEN",
    });
    if (assignmentError) throw new Error("A3 Assignment insert failed", { cause: assignmentError });

    for (const [page, studentNumber] of [[1, 4], [2, 20]]) {
      const student = roster.find((item) => item.student_number === studentNumber);
      if (!student) throw new Error(`A3 PDF Student ${studentNumber} is not in the Demo Roster`);
      const submissionId = randomUUID();
      const rangeArtifactId = randomUUID();
      const structuredInput = realA3Input(studentNumber);
      const { error: submissionError } = await supabase.from("submissions").insert({
        id: submissionId,
        student_id: student.id,
        activity_assignment_id: assignmentId,
        structured_input: structuredInput,
        input_status: "READY_FOR_PROCESS",
        process_status: "READY_TO_ANALYZE",
        current_attempt_no: 1,
        submitted_at: new Date().toISOString(),
      });
      if (submissionError) throw new Error(`A3 Student ${studentNumber} Submission insert failed`, { cause: submissionError });
      createdSubmissionIds.push(submissionId);
      const { error: rangeError } = await supabase.from("artifacts").insert({
        id: rangeArtifactId,
        submission_id: submissionId,
        owner_teacher_id: null,
        source_artifact_id: sourceArtifactId,
        storage_path: storagePath,
        file_name: config.sourceFile,
        mime_type: "application/pdf",
        file_size_bytes: pdf.byteLength,
        checksum,
        artifact_role: "DERIVED",
        attempt_no: 1,
        page_start: page,
        page_end: page,
      });
      if (rangeError) throw new Error(`A3 Student ${studentNumber} page Artifact failed`, { cause: rangeError });
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_teacher_id: classItem.teacher_id,
      action: "ARTIFACT_UPLOAD",
      entity_type: "Artifact",
      entity_id: sourceArtifactId,
      request_id: randomUUID(),
      metadata_json: null,
    });
    if (auditError) throw new Error("A3 Artifact audit insert failed", { cause: auditError });
  } catch (error) {
    if (activityInserted) await supabase.from("activities").delete().eq("id", activityId);
    if (sourceInserted) await supabase.from("artifacts").delete().eq("id", sourceArtifactId);
    if (uploaded) await supabase.storage.from("trace").remove([storagePath]);
    throw error;
  }

  console.log(JSON.stringify({
    activityId,
    assignmentId,
    parentActivityId: previousActivity.id,
    subject: config.subject,
    domain: config.domain,
    standardId: config.standardId,
    activityCode: config.activityCode,
    sourceArtifactId,
    sourceChecksumVerified: true,
    realPdfSubmissionCount: createdSubmissionIds.length,
    externalAiUsed: false,
    a4Touched: false,
  }, null, 2));
}

await main();
