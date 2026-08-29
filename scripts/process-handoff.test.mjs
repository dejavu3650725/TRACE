import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProcessHandoffContexts,
  ProcessHandoffContractError,
} from "../src/features/process/handoff-contract.ts";

const teacherId = "teacher-a";
const structuredInput = {
  schema_version: "1",
  questions: [{
    question_id: "Q1",
    response_type: "short_text",
    response: { raw_text: "관찰 가능한 합성 응답" },
  }],
};

function submission(id, studentId, patch = {}) {
  return {
    id,
    studentId,
    studentClassId: "class-a",
    classId: "class-a",
    classTeacherId: teacherId,
    assignmentId: "assignment-a4",
    activityId: "activity-a4",
    activityTeacherId: teacherId,
    activityTitle: "Synthetic Activity A4",
    activityDescription: "Synthetic handoff activity",
    standardIds: ["4국02-01"],
    structuredInput,
    inputStatus: "READY_FOR_PROCESS",
    processStatus: "READY_TO_ANALYZE",
    ...patch,
  };
}

const liveS = submission("submission-live-s", "student-s");
const liveT = submission("submission-live-t", "student-t");
const prepared18 = Array.from({ length: 18 }, (_, index) => submission(
  `submission-prepared-${index + 1}`,
  `student-prepared-${index + 1}`,
  { assignmentId: "assignment-a1", activityId: "activity-a1" },
));
const artifacts = [
  {
    id: "artifact-live-s",
    submissionId: liveS.id,
    sourceArtifactId: null,
    storagePath: "teachers/teacher-a/submissions/submission-live-s/original/page.png",
    mimeType: "image/png",
    artifactRole: "ORIGINAL",
    pageStart: null,
    pageEnd: null,
  },
  {
    id: "artifact-live-t-range",
    submissionId: liveT.id,
    sourceArtifactId: "artifact-batch-original",
    storagePath: "teachers/teacher-a/batches/artifact-batch-original/original/source.pdf",
    mimeType: "application/pdf",
    artifactRole: "DERIVED",
    pageStart: 3,
    pageEnd: 4,
  },
];
const sources = [{
  id: "artifact-batch-original",
  ownerTeacherId: teacherId,
  storagePath: "teachers/teacher-a/batches/artifact-batch-original/original/source.pdf",
  mimeType: "application/pdf",
  artifactRole: "ORIGINAL",
}];

function resolve(requestedSubmissionIds, overrides = {}) {
  return buildProcessHandoffContexts({
    requestedSubmissionIds,
    teacherId,
    submissions: [...prepared18, liveS, liveT],
    artifacts,
    sources,
    ...overrides,
  });
}

test("PROCESS resolves live S/T from IDs without rerunning the 18 prepared submissions", () => {
  const contexts = resolve([liveS.id, liveT.id]);
  assert.deepEqual(contexts.map((context) => context.submissionId), [liveS.id, liveT.id]);
  assert.equal(contexts.length, 2);
  assert.equal(contexts[0].studentId, "student-s");
  assert.equal(contexts[0].classId, "class-a");
  assert.equal(contexts[0].assignmentId, "assignment-a4");
  assert.equal(contexts[0].activity.id, "activity-a4");
  assert.deepEqual(contexts[0].activity.standardIds, ["4국02-01"]);
  assert.deepEqual(contexts[0].structuredInput, structuredInput);
  assert.equal(contexts[0].inputStatus, "READY_FOR_PROCESS");
  assert.equal(contexts[0].processStatus, "READY_TO_ANALYZE");
});

test("PROCESS resolves both direct ORIGINAL and Batch page-range ORIGINAL references", () => {
  const contexts = resolve([liveS.id, liveT.id]);
  assert.equal(contexts[0].artifacts[0].originalArtifactId, "artifact-live-s");
  assert.equal(contexts[1].artifacts[0].originalArtifactId, "artifact-batch-original");
  assert.equal(contexts[1].artifacts[0].artifactId, "artifact-live-t-range");
  assert.deepEqual([contexts[1].artifacts[0].pageStart, contexts[1].artifacts[0].pageEnd], [3, 4]);
});

test("REVIEW_PENDING and invalid StructuredInput are blocked before handoff", () => {
  for (const invalid of [
    submission("submission-review", "student-review", { inputStatus: "REVIEW_PENDING" }),
    submission("submission-invalid-input", "student-invalid", { structuredInput: null }),
  ]) {
    assert.throws(
      () => resolve([invalid.id], { submissions: [invalid] }),
      (error) => error instanceof ProcessHandoffContractError && error.code === "NOT_READY",
    );
  }
});

test("handoff requires a persisted ORIGINAL or valid Batch source reference", () => {
  assert.throws(
    () => resolve([liveS.id], { artifacts: [], sources: [] }),
    (error) => error instanceof ProcessHandoffContractError
      && error.code === "NOT_READY"
      && /ORIGINAL/.test(error.message),
  );
});

test("foreign ownership and cross-Class Student relations fail closed", () => {
  for (const invalid of [
    submission("submission-foreign", "student-foreign", { activityTeacherId: "teacher-b" }),
    submission("submission-cross-class", "student-cross", { studentClassId: "class-b" }),
  ]) {
    assert.throws(
      () => resolve([invalid.id], { submissions: [invalid] }),
      (error) => error instanceof ProcessHandoffContractError && error.code === "FORBIDDEN",
    );
  }
});
