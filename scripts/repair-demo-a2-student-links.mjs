import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { StructuredInputRuntimeSchema } from "../src/features/submissions/structured-input-schema.ts";
import { DEMO_HISTORY_ACTIVITIES } from "./demo-history-fixtures.mjs";

const ACTUAL_A2_INPUTS = {
  4: {
    schema_version: "1",
    questions: [{
      question_id: "Q1",
      response_type: "underline",
      response: {
        underlined_sentences: [
          "학교 도서관은 우리에게 많은 도움을 주는 소중한 곳입니다.",
          "학교에 갈 준비를 꼼꼼하게 해서 준비물을 빠뜨리지 않습니다.",
          "운동은 우리 몸과 마음을 건강하게 해 줍니다.",
          "이렇게 우리나라는 사계절의 모습이 각각 다르고 아름답습니다.",
          "자기가 가지고 논 장난감을 스스로 정리하는 것도 좋은 방법입니다.",
        ],
      },
    }],
  },
  20: {
    schema_version: "1",
    questions: [{
      question_id: "Q1",
      response_type: "underline",
      response: {
        underlined_sentences: [
          "학교 도서관은 우리에게 많은 도움을 주는 소중한 곳입니다.",
          "이처럼 일찍 일어나는 습관은 우리에게 좋은 점이 많습니다.",
          "운동은 우리 몸과 마음을 건강하게 해 줍니다.",
          "이렇게 우리나라는 사계절의 모습이 각각 다르고 아름답습니다.",
          "가족을 돕는 방법은 여러 가지가 있습니다.",
        ],
      },
    }],
  },
};

function requiredEnv(name, fallbacks = []) {
  for (const key of [name, ...fallbacks]) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  throw new Error(`${name} is required for the server-only demo repair`);
}

function oneRow(rows, label) {
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error(`${label} must resolve to exactly one row; found ${rows?.length ?? 0}`);
  }
  return rows[0];
}

async function main() {
  const config = DEMO_HISTORY_ACTIVITIES.a2;
  const supabase = createClient(
    requiredEnv("SUPABASE_URL", ["NEXT_PUBLIC_SUPABASE_URL"]),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: classes, error: classError } = await supabase
    .from("classes")
    .select("id, teacher_id")
    .eq("is_active", true);
  if (classError) throw new Error("Could not read Class candidates", { cause: classError });

  const { data: rosterRows, error: rosterError } = await supabase
    .from("students")
    .select("id, class_id, student_number, name")
    .in("class_id", (classes ?? []).map((item) => item.id))
    .eq("is_active", true);
  if (rosterError) throw new Error("Could not read Roster candidates", { cause: rosterError });

  const classItem = oneRow(
    (classes ?? []).filter((item) => (
      (rosterRows ?? []).filter((student) => student.class_id === item.id).length === 20
    )),
    "20-Student Demo Class",
  );
  const roster = (rosterRows ?? [])
    .filter((student) => student.class_id === classItem.id)
    .sort((left, right) => left.student_number - right.student_number);
  assert.deepEqual(roster.map((student) => student.student_number), Array.from({ length: 20 }, (_, index) => index + 1));

  const student4 = oneRow(roster.filter((student) => student.student_number === 4), "Student 4");
  const student20 = oneRow(roster.filter((student) => student.student_number === 20), "Student 20");
  assert.equal(student4.name, "김겸율");
  assert.equal(student20.name, "유마루");

  const { data: activities, error: activityError } = await supabase
    .from("activities")
    .select("id, teacher_id, title")
    .eq("teacher_id", classItem.teacher_id)
    .ilike("title", `%${config.titleIncludes}%`);
  if (activityError) throw new Error("Could not read a2 Activity", { cause: activityError });
  const activity = oneRow(activities, "a2 Activity");

  const { data: assignments, error: assignmentError } = await supabase
    .from("activity_assignments")
    .select("id, class_id")
    .eq("activity_id", activity.id)
    .eq("class_id", classItem.id);
  if (assignmentError) throw new Error("Could not read a2 ActivityAssignment", { cause: assignmentError });
  const assignment = oneRow(assignments, "a2 ActivityAssignment");

  const { data: sources, error: sourceError } = await supabase
    .from("artifacts")
    .select("id, owner_teacher_id, storage_path, file_name, mime_type, file_size_bytes, checksum, attempt_no, page_start, page_end")
    .eq("owner_teacher_id", classItem.teacher_id)
    .eq("artifact_role", "ORIGINAL")
    .eq("mime_type", "application/pdf")
    .eq("checksum", config.sourceChecksum);
  if (sourceError) throw new Error("Could not read a2 Batch source", { cause: sourceError });
  const source = oneRow(sources, "a2 Batch ORIGINAL");
  assert.equal(source.file_name, config.sourceFile);
  assert.equal(source.page_start, 1);
  assert.equal(source.page_end, 2);

  const parsedInputs = {
    4: StructuredInputRuntimeSchema.parse(ACTUAL_A2_INPUTS[4]),
    20: StructuredInputRuntimeSchema.parse(ACTUAL_A2_INPUTS[20]),
  };

  const { data: currentSubmissions, error: submissionError } = await supabase
    .from("submissions")
    .select("id, student_id, structured_input, input_status")
    .eq("activity_assignment_id", assignment.id)
    .in("student_id", [student4.id, student20.id]);
  if (submissionError) throw new Error("Could not read real a2 Submissions", { cause: submissionError });
  const submission4 = oneRow(
    (currentSubmissions ?? []).filter((submission) => submission.student_id === student4.id),
    "김겸율 a2 Submission",
  );
  let submission20 = (currentSubmissions ?? []).find((submission) => submission.student_id === student20.id) ?? null;

  const { data: rangeRows, error: rangeError } = await supabase
    .from("artifacts")
    .select("id, submission_id, source_artifact_id, page_start, page_end")
    .eq("source_artifact_id", source.id)
    .eq("artifact_role", "DERIVED");
  if (rangeError) throw new Error("Could not read a2 page ranges", { cause: rangeError });
  let range4 = (rangeRows ?? []).find((range) => range.submission_id === submission4.id) ?? null;
  let range20 = submission20
    ? (rangeRows ?? []).find((range) => range.submission_id === submission20.id) ?? null
    : null;
  if (!range4) throw new Error("김겸율 a2 page range is missing");

  let createdSubmission20 = false;
  let createdRange20 = false;
  const originalRange4 = { page_start: range4.page_start, page_end: range4.page_end };
  const originalSubmission4 = {
    structured_input: submission4.structured_input,
    input_status: submission4.input_status,
  };

  try {
    if (!submission20) {
      const id = randomUUID();
      const { data, error } = await supabase.from("submissions").insert({
        id,
        student_id: student20.id,
        activity_assignment_id: assignment.id,
        structured_input: parsedInputs[20],
        input_status: "STORED",
        process_status: "NOT_STARTED",
        current_attempt_no: 1,
      }).select("id, student_id, structured_input, input_status").single();
      if (error) throw new Error("유마루 a2 Submission insert failed", { cause: error });
      submission20 = data;
      createdSubmission20 = true;
    }

    if (range4.page_start !== 1 || range4.page_end !== 1) {
      if (range4.page_start !== 1 || range4.page_end !== 2 || range20) {
        throw new Error("Unexpected a2 page-range state; repair stopped without guessing");
      }
      const { data, error } = await supabase
        .from("artifacts")
        .update({ page_end: 1 })
        .eq("id", range4.id)
        .select("id, submission_id, source_artifact_id, page_start, page_end")
        .single();
      if (error) throw new Error("김겸율 page range update failed", { cause: error });
      range4 = data;
    }

    if (!range20) {
      const id = randomUUID();
      const { data, error } = await supabase.from("artifacts").insert({
        id,
        submission_id: submission20.id,
        owner_teacher_id: null,
        source_artifact_id: source.id,
        storage_path: source.storage_path,
        file_name: source.file_name,
        mime_type: source.mime_type,
        file_size_bytes: source.file_size_bytes,
        checksum: source.checksum,
        artifact_role: "DERIVED",
        attempt_no: source.attempt_no,
        page_start: 2,
        page_end: 2,
      }).select("id, submission_id, source_artifact_id, page_start, page_end").single();
      if (error) throw new Error("유마루 page range insert failed", { cause: error });
      range20 = data;
      createdRange20 = true;
    }

    assert.equal(range4.page_start, 1);
    assert.equal(range4.page_end, 1);
    assert.equal(range20.page_start, 2);
    assert.equal(range20.page_end, 2);
    assert.equal(range20.source_artifact_id, source.id);

    const readyState = {
      input_status: "READY_FOR_PROCESS",
      process_status: "READY_TO_ANALYZE",
      submitted_at: new Date().toISOString(),
    };
    const { error: update4Error } = await supabase.from("submissions").update({
      ...readyState,
      structured_input: parsedInputs[4],
    }).eq("id", submission4.id);
    if (update4Error) throw new Error("김겸율 actual a2 response update failed", { cause: update4Error });

    const { error: update20Error } = await supabase.from("submissions").update({
      ...readyState,
      structured_input: parsedInputs[20],
    }).eq("id", submission20.id);
    if (update20Error) throw new Error("유마루 actual a2 response update failed", { cause: update20Error });
  } catch (error) {
    if (createdRange20 && range20) await supabase.from("artifacts").delete().eq("id", range20.id);
    if (range4.page_end !== originalRange4.page_end) {
      await supabase.from("artifacts").update(originalRange4).eq("id", range4.id);
    }
    await supabase.from("submissions").update(originalSubmission4).eq("id", submission4.id);
    if (createdSubmission20 && submission20) await supabase.from("submissions").delete().eq("id", submission20.id);
    throw error;
  }

  const { data: verified, error: verifyError } = await supabase
    .from("submissions")
    .select("id, student_id, input_status, process_status, structured_input, artifacts(source_artifact_id,page_start,page_end)")
    .eq("activity_assignment_id", assignment.id)
    .in("student_id", [student4.id, student20.id]);
  if (verifyError) throw new Error("a2 real Submission verification failed", { cause: verifyError });
  assert.equal(verified?.length, 2);
  for (const submission of verified ?? []) {
    assert.equal(submission.input_status, "READY_FOR_PROCESS");
    assert.equal(submission.process_status, "READY_TO_ANALYZE");
    StructuredInputRuntimeSchema.parse(submission.structured_input);
    assert.equal(submission.artifacts.length, 1);
    assert.equal(submission.artifacts[0].source_artifact_id, source.id);
  }

  console.log(JSON.stringify({
    activityKey: "a2",
    activityId: activity.id,
    assignmentId: assignment.id,
    sourceChecksumVerified: true,
    actualStudents: [
      { studentNumber: 4, name: student4.name, page: 1, submissionId: submission4.id },
      { studentNumber: 20, name: student20.name, page: 2, submissionId: submission20.id },
    ],
    a4Touched: false,
  }, null, 2));
}

await main();
