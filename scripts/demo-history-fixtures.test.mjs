import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { StructuredInputRuntimeSchema } from "../src/features/submissions/structured-input-schema.ts";
import {
  buildSyntheticStructuredInput,
  DEMO_HISTORY_ACTIVITIES,
  LIVE_DEMO_STUDENT_NUMBERS,
  syntheticProfileForStudent,
} from "./demo-history-fixtures.mjs";

const SYNTHETIC_STUDENT_NUMBERS = Array.from(
  { length: 20 },
  (_, index) => index + 1,
).filter((studentNumber) => !LIVE_DEMO_STUDENT_NUMBERS.has(studentNumber));

test("a1, a2, a3만 순서대로 정의하고 a4는 시드 대상에서 제외한다", () => {
  assert.deepEqual(Object.keys(DEMO_HISTORY_ACTIVITIES), ["a1", "a2", "a3"]);
  assert.equal(DEMO_HISTORY_ACTIVITIES.a1.previousKey, null);
  assert.equal(DEMO_HISTORY_ACTIVITIES.a2.previousKey, "a1");
  assert.equal(DEMO_HISTORY_ACTIVITIES.a3.previousKey, "a2");
  for (const activity of Object.values(DEMO_HISTORY_ACTIVITIES)) {
    assert.equal(activity.subject, "국어");
    assert.equal(activity.domain, "읽기");
    assert.equal(activity.standardId, "4국02-02");
  }
  assert.equal(new Set(Object.values(DEMO_HISTORY_ACTIVITIES).map((activity) => activity.activityCode)).size, 3);
  assert.equal(Object.hasOwn(DEMO_HISTORY_ACTIVITIES, "a4"), false);
});

test("4번과 20번은 실제 PDF 경로에 남기고 합성 응답을 만들지 않는다", () => {
  assert.deepEqual([...LIVE_DEMO_STUDENT_NUMBERS], [4, 20]);
  for (const studentNumber of LIVE_DEMO_STUDENT_NUMBERS) {
    assert.equal(syntheticProfileForStudent(studentNumber), null);
    assert.throws(
      () => buildSyntheticStructuredInput("a1", studentNumber),
      /reserved for the real PDF path/,
    );
  }
  assert.equal(SYNTHETIC_STUDENT_NUMBERS.length, 18);
});

test("18명은 네 개의 서로 다른 작성 분포군으로 구성한다", () => {
  const counts = Object.groupBy(
    SYNTHETIC_STUDENT_NUMBERS,
    (studentNumber) => syntheticProfileForStudent(studentNumber),
  );
  assert.deepEqual(
    Object.fromEntries(Object.entries(counts).map(([profile, values]) => [profile, values.length])),
    { consistent: 6, improving: 5, variable: 4, support: 3 },
  );
});

test("a1~a3의 54개 합성 StructuredInput은 관찰 응답 계약을 모두 통과한다", () => {
  for (const [activityKey, config] of Object.entries(DEMO_HISTORY_ACTIVITIES)) {
    for (const studentNumber of SYNTHETIC_STUDENT_NUMBERS) {
      const input = StructuredInputRuntimeSchema.parse(
        buildSyntheticStructuredInput(activityKey, studentNumber),
      );
      assert.deepEqual(
        input.questions.map((question) => question.question_id),
        config.questionIds,
      );
    }
  }
});

test("각 차시에는 한 가지로 복제되지 않은 다양한 학생 작성값이 있다", () => {
  for (const activityKey of Object.keys(DEMO_HISTORY_ACTIVITIES)) {
    const distinctInputs = new Set(SYNTHETIC_STUDENT_NUMBERS.map((studentNumber) => (
      JSON.stringify(buildSyntheticStructuredInput(activityKey, studentNumber))
    )));
    assert.ok(distinctInputs.size >= 6, `${activityKey} has only ${distinctInputs.size} variants`);
  }
});

test("설정된 a1~a3 원본 체크섬은 로컬 PDF와 정확히 일치한다", async () => {
  for (const config of Object.values(DEMO_HISTORY_ACTIVITIES)) {
    const bytes = await readFile(new URL(`../샘플 데이터/${config.sourceFile}`, import.meta.url));
    const checksum = createHash("sha256").update(bytes).digest("hex");
    assert.equal(checksum, config.sourceChecksum);
  }
});
