import assert from "node:assert/strict";
import test from "node:test";

const {
  APPROVED_OUTPUT_ANALYSIS_STATUSES,
  activityReportDemo,
  isObservedOnlyStructuredInput,
  selectApprovedOutputAnalyses,
  validateActivityReportDemo,
}: typeof import("./activity-report-demo") = await import("./activity-report-demo" + ".ts");

test("synthetic activity report demo contains only allowed output statuses", () => {
  assert.deepEqual(APPROVED_OUTPUT_ANALYSIS_STATUSES, ["APPROVED", "EDITED_APPROVED"]);

  for (const timepoint of activityReportDemo.timepoints) {
    assert.ok(
      selectApprovedOutputAnalyses(timepoint.submission.structured_input, timepoint.analyses).every(
        (analysis) => APPROVED_OUTPUT_ANALYSIS_STATUSES.includes(analysis.status),
      ),
    );
  }
});

test("synthetic activity report demo excludes rejected candidates", () => {
  const firstTimepoint = activityReportDemo.timepoints[0];
  const selected = selectApprovedOutputAnalyses(
    firstTimepoint.submission.structured_input,
    firstTimepoint.analyses,
  );

  assert.equal(firstTimepoint.analyses.some((analysis) => analysis.status === "REJECTED"), true);
  assert.equal(selected.some((analysis) => analysis.status === "REJECTED"), false);
});

test("synthetic activity report demo preserves distinct dates and PDF page ranges", () => {
  const [firstTimepoint, secondTimepoint] = activityReportDemo.timepoints;

  assert.notEqual(firstTimepoint.submission.submitted_at, secondTimepoint.submission.submitted_at);
  assert.deepEqual(
    activityReportDemo.timepoints.map(({ artifact }) => [artifact.page_start, artifact.page_end]),
    [
      [1, 1],
      [2, 2],
    ],
  );
  assert.equal(firstTimepoint.artifact.storage_path, secondTimepoint.artifact.storage_path);
});

test("StructuredInput has observed-only fields and rejects judgment-shaped input", () => {
  for (const { submission } of activityReportDemo.timepoints) {
    assert.equal(isObservedOnlyStructuredInput(submission.structured_input), true);
    assert.equal(JSON.stringify(submission.structured_input).includes("judgment"), false);
    assert.equal(JSON.stringify(submission.structured_input).includes("score"), false);
    assert.equal(JSON.stringify(submission.structured_input).includes("grade"), false);
  }

  const malformedInput = {
    ...activityReportDemo.timepoints[0].submission.structured_input,
    judgment: "student is successful",
  };

  assert.equal(isObservedOnlyStructuredInput(malformedInput), false);
  assert.throws(
    () => selectApprovedOutputAnalyses(malformedInput, activityReportDemo.timepoints[0].analyses),
    /observed-only/i,
  );
});

test("StructuredInput rejects every observed_text injection regardless of wording", () => {
  for (const observedText of [
    "The student mastered fractions and is successful.",
    "The student understands fractions.",
    "The student has a misconception about fractions.",
    "학생은 분수를 이해했다.",
  ]) {
    const observedTextInjection = {
      ...activityReportDemo.timepoints[0].submission.structured_input,
      questions: activityReportDemo.timepoints[0].submission.structured_input.questions.map((question) => ({
        ...question,
        response: { ...question.response, observed_text: observedText },
      })),
    };

    assert.equal(isObservedOnlyStructuredInput(observedTextInjection), false);
    assert.throws(
      () => selectApprovedOutputAnalyses(observedTextInjection, activityReportDemo.timepoints[0].analyses),
      /observed-only/i,
    );
  }
});

test("StructuredInput preserves educational vocabulary in student-authored literal fields", () => {
  const rawStudentText = {
    schema_version: "observed-input-v0.1",
    questions: [
      {
        question_id: "q-student-literal",
        response_type: "long_text",
        response: { raw_text: "I mastered fractions and my score improved." },
      },
    ],
  };
  const writtenExpression = structuredClone(activityReportDemo.timepoints[0].submission.structured_input);
  writtenExpression.questions[0].response.written_expression = "성취 수준: 2/4";

  assert.equal(isObservedOnlyStructuredInput(rawStudentText), true);
  assert.equal(isObservedOnlyStructuredInput(writtenExpression), true);
});

test("StructuredInput rejects ai_inference fields from validator and selector", () => {
  const aiInferenceInput = {
    ...activityReportDemo.timepoints[0].submission.structured_input,
    questions: activityReportDemo.timepoints[0].submission.structured_input.questions.map((question) => ({
      ...question,
      response: {
        ...question.response,
        ai_inference: "mastered",
      },
    })),
  };
  const validatorAccepts = isObservedOnlyStructuredInput(aiInferenceInput);
  let selectorAccepts = true;

  try {
    selectApprovedOutputAnalyses(aiInferenceInput, activityReportDemo.timepoints[0].analyses);
  } catch {
    selectorAccepts = false;
  }

  assert.deepEqual(
    { validatorAccepts, selectorAccepts },
    { validatorAccepts: false, selectorAccepts: false },
  );
});

test("each Evidence row traces to its Artifact and the approved GrowthEvent links both", () => {
  const evidenceIds = new Set(activityReportDemo.timepoints.map(({ evidence }) => evidence.id));
  const artifactIds = new Set(activityReportDemo.timepoints.map(({ artifact }) => artifact.id));

  for (const { evidence } of activityReportDemo.timepoints) {
    assert.ok(evidence.artifact_id);
    assert.ok(artifactIds.has(evidence.artifact_id));
  }

  assert.equal(activityReportDemo.growthEvent.status, "APPROVED");
  assert.deepEqual(
    new Set(activityReportDemo.growthEventEvidence.map(({ evidence_id }) => evidence_id)),
    evidenceIds,
  );
});

test("edited approval records a meaningful teacher edit delta", () => {
  const editedTimepoint = activityReportDemo.timepoints.find(({ analysis }) => analysis.status === "EDITED_APPROVED");

  assert.ok(editedTimepoint);
  assert.equal(editedTimepoint.review.decision, "EDITED_APPROVED");
  assert.ok(editedTimepoint.review.teacher_edits);
  assert.notEqual(
    editedTimepoint.review.teacher_edits.feedback_after,
    editedTimepoint.review.teacher_edits.feedback_before,
  );
  assert.ok(editedTimepoint.review.teacher_edits.rationale.length > 20);
});

test("the fixture validates as a provisional output-demo-v0.1 contract", () => {
  assert.equal(validateActivityReportDemo(activityReportDemo), true);
  assert.equal(activityReportDemo.contract_version, "output-demo-v0.1");
  assert.equal(activityReportDemo.provisional, true);
});

test("stale state imports the current fixture", async () => {
  const currentModule: typeof import("./activity-report-demo") = await import(
    "./activity-report-demo" + ".ts",
  );

  assert.equal(currentModule.activityReportDemo, activityReportDemo);
  assert.equal(currentModule.validateActivityReportDemo(currentModule.activityReportDemo), true);
});
