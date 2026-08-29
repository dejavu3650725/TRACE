import assert from "node:assert/strict";
import test from "node:test";
import { matchVisibleStudentIdentity } from "../src/features/artifacts/batch-matching.ts";
import { StructuredInputRuntimeSchema } from "../src/features/submissions/structured-input-schema.ts";
import { extractBatchPdfWithVlm } from "../src/lib/ai/batch-pdf-extraction.ts";

const roster = [
  { id: "student-1", studentNumber: 1, studentName: "강서윤" },
  { id: "student-2", studentNumber: 2, studentName: "박도윤" },
  { id: "student-3", studentNumber: 3, studentName: "최하린" },
];

test("shuffled visible identities match by exact number and name, never array order", () => {
  const shuffled = [
    { grade: "3", className: "1", studentNumber: "3", studentName: "최하린", uncertain: false },
    { grade: "3", className: "1", studentNumber: "1", studentName: "강서윤", uncertain: false },
    { grade: "3", className: "1", studentNumber: "2", studentName: "박도윤", uncertain: false },
  ];
  assert.deepEqual(
    shuffled.map((identity) => {
      const result = matchVisibleStudentIdentity(identity, roster);
      return result.status === "MATCHED" ? result.student.id : result.status;
    }),
    ["student-3", "student-1", "student-2"],
  );
});

test("missing, uncertain, or mismatched identity always stays REVIEW_PENDING", () => {
  assert.equal(matchVisibleStudentIdentity({ grade: "3", className: "1", studentNumber: null, studentName: "강서윤", uncertain: false }, roster).status, "REVIEW_PENDING");
  assert.equal(matchVisibleStudentIdentity({ grade: "3", className: "1", studentNumber: "1", studentName: "강서윤", uncertain: true }, roster).status, "REVIEW_PENDING");
  assert.equal(matchVisibleStudentIdentity({ grade: "3", className: "1", studentNumber: "1", studentName: "박도윤", uncertain: false }, roster).status, "REVIEW_PENDING");
});

test("StructuredInput accepts observable answers only", () => {
  const input = StructuredInputRuntimeSchema.parse({
    schema_version: "1",
    questions: [
      { question_id: "Q1", response_type: "short_text", response: { raw_text: "3/5", is_blank: false } },
      { question_id: "Q2", response_type: "long_text", response: { raw_text: "분자가 더 크기 때문입니다.", is_blank: false } },
    ],
  });
  assert.equal(input.questions.length, 2);
  assert.equal(input.questions[0].response.raw_text, "3/5");
});

test("StructuredInput rejects identity, judgment, extra envelope fields and duplicate question IDs", () => {
  for (const invalid of [
    { schema_version: "1", questions: [{ question_id: "Q1", response_type: "short_text", response: { student_name: "합성학생" } }] },
    { schema_version: "1", questions: [{ question_id: "Q1", response_type: "short_text", response: { correctness: true } }] },
    { schema_version: "1", questions: [{ question_id: "Q1", response_type: "short_text", response: { raw_text: "답" }, score: 3 }] },
    { schema_version: "1", questions: [
      { question_id: "Q1", response_type: "short_text", response: { raw_text: "답1" } },
      { question_id: "Q1", response_type: "short_text", response: { raw_text: "답2" } },
    ] },
  ]) {
    assert.equal(StructuredInputRuntimeSchema.safeParse(invalid).success, false);
  }
});

test("Batch VLM request includes PDF/activity/ranges but never a roster", async () => {
  let serializedRequest = "";
  let capturedRequest;
  const adapter = {
    provider: "google",
    model: "synthetic-model",
    async generate(request) {
      capturedRequest = request;
      serializedRequest = JSON.stringify(request);
      return {
        ok: true,
        outputText: JSON.stringify({
          groups: [
            {
              range_index: 1,
              visible_grade: "3",
              visible_class: "1",
              visible_number: "1",
              visible_name: "강서윤",
              identity_uncertain: false,
              questions: [{
                question_id: "Q1", visible_prompt: "더 큰 분수를 쓰세요.", response_type: "short_text",
                raw_text: "3/5", selected_options: [], marks: [], drawing_description: null,
                is_blank: false, uncertain: false,
              }],
            },
            {
              range_index: 0,
              visible_grade: "3",
              visible_class: "1",
              visible_number: "3",
              visible_name: "최하린",
              identity_uncertain: false,
              questions: [{
                question_id: "Q1", visible_prompt: "더 큰 분수를 쓰세요.", response_type: "short_text",
                raw_text: "3/5", selected_options: [], marks: [], drawing_description: null,
                is_blank: false, uncertain: false,
              }],
            },
          ],
        }),
        meta: { requestId: "synthetic", provider: "google", model: "synthetic-model", durationMs: 1, retryCount: 0 },
      };
    },
  };

  const result = await extractBatchPdfWithVlm({
    activity: {
      title: "분수 비교",
      description: "관찰 가능한 답안을 읽는 합성 활동",
      grade: 3,
      questions: [{ questionId: "Q1", prompt: "더 큰 분수를 쓰세요.", responseType: "short_text", options: [] }],
    },
    pageRanges: [
      { rangeIndex: 0, pageStart: 1, pageEnd: 1 },
      { rangeIndex: 1, pageStart: 2, pageEnd: 2 },
    ],
    pdfBase64: "aGVsbG8=",
  }, adapter);

  assert.deepEqual(result.map((group) => group.rangeIndex), [1, 0]);
  assert.equal(serializedRequest.includes("application/pdf"), true);
  assert.equal(serializedRequest.includes("pageStart"), true);
  assert.equal(capturedRequest.generationConfig.responseMimeType, "application/json");
  assert.equal(capturedRequest.generationConfig.responseJsonSchema.type, "object");
  assert.equal(capturedRequest.generationConfig.responseJsonSchema.properties.groups.type, "array");
  for (const forbidden of ["roster", "student-1", "student-2", "student-3", "박도윤"]) {
    assert.equal(serializedRequest.toLowerCase().includes(forbidden.toLowerCase()), false);
  }
});
