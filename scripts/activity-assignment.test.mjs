import assert from "node:assert/strict";
import test from "node:test";
import { buildActivityCodePrefix } from "../src/features/activities/code.ts";
import {
  gradeBandForNumericGrade,
  gradeBandsForSchoolLevel,
  inferCurriculumLabel,
  schoolLevelForNumericGrade,
  schoolLevelMatchesGrade,
} from "../src/features/activities/curriculum.ts";
import { parseActivityInput, parseAssignmentSchedule } from "../src/features/activities/validation.ts";

function form(entries) {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

test("Activity Code prefix follows the human-readable PRD segments", () => {
  assert.equal(buildActivityCodePrefix({ subject: "국어", grade: 3, standardId: "4국03-02" }), "KOR-03-03-02");
  assert.equal(buildActivityCodePrefix({ subject: "정보", grade: 9, standardId: "9정01-01" }), "INFO-09-01-01");
  assert.equal(buildActivityCodePrefix({ subject: null, grade: null, standardId: null }), "ETC-00-00-00");
});

test("numeric Activity grades select the matching elementary Curriculum band", () => {
  assert.equal(gradeBandForNumericGrade(1), "1~2학년");
  assert.equal(gradeBandForNumericGrade(3), "3~4학년");
  assert.equal(gradeBandForNumericGrade(6), "5~6학년");
  assert.equal(gradeBandForNumericGrade(9), null);
  assert.equal(gradeBandForNumericGrade(10), "고1~3(선택)");
  assert.equal(gradeBandForNumericGrade(null), null);
});

test("Curriculum school level must be chosen before a supported grade band", () => {
  assert.deepEqual(gradeBandsForSchoolLevel("초등학교"), ["1~2학년", "3~4학년", "5~6학년"]);
  assert.deepEqual(gradeBandsForSchoolLevel("고등학교"), ["고1~3(선택)"]);
  assert.equal(schoolLevelForNumericGrade(3), "초등학교");
  assert.equal(schoolLevelForNumericGrade(10), "고등학교");
  assert.equal(schoolLevelForNumericGrade(8), null);
  assert.equal(schoolLevelMatchesGrade("초등학교", 3), true);
  assert.equal(schoolLevelMatchesGrade("초등학교", 10), false);
});

test("natural-language Curriculum facet inference never chooses an unrelated subject", () => {
  const subjects = ["과학", "국어", "도덕", "사회"];
  assert.equal(inferCurriculumLabel("3학년 국어 읽기 활동지를 만들어 주세요.", subjects), "국어");
  assert.equal(inferCurriculumLabel("3 학년 국 어 읽기 활동", subjects), "국어");
  assert.equal(inferCurriculumLabel("3학년 활동지를 만들어 주세요.", subjects), null);
  assert.equal(inferCurriculumLabel("국어와 사회를 연결한 활동", subjects), null);
});

test("Activity input keeps optional metadata optional and deduplicates Standards", () => {
  assert.deepEqual(
    parseActivityInput(form([
      ["title", "  합성 중심 문장 활동  "],
      ["grade", "3"],
      ["subject", "국어"],
      ["domain", ""],
      ["unit", ""],
      ["activityType", "활동지"],
      ["description", "  설명  "],
      ["parentActivityId", ""],
      ["standardIds", "4국03-01"],
      ["standardIds", "4국03-01"],
    ])),
    {
      title: "합성 중심 문장 활동",
      grade: 3,
      subject: "국어",
      domain: null,
      unit: null,
      activityType: "활동지",
      description: "설명",
      parentActivityId: null,
      standardIds: ["4국03-01"],
    },
  );
});

test("Activity input rejects invalid grades and parent IDs", () => {
  assert.equal(parseActivityInput(form([["title", "합성 활동"], ["grade", "13"], ["parentActivityId", ""]])), null);
  assert.equal(parseActivityInput(form([["title", "합성 활동"], ["grade", "3"], ["parentActivityId", "not-an-id"]])), null);
});

test("Assignment schedule converts Korean local time and rejects reversed dates", () => {
  assert.deepEqual(
    parseAssignmentSchedule(form([["status", "OPEN"], ["openAt", "2026-09-01T09:00"], ["dueAt", "2026-09-02T18:00"]])),
    { status: "OPEN", openAt: "2026-09-01T00:00:00.000Z", dueAt: "2026-09-02T09:00:00.000Z" },
  );
  assert.equal(
    parseAssignmentSchedule(form([["status", "OPEN"], ["openAt", "2026-09-03T09:00"], ["dueAt", "2026-09-02T18:00"]])),
    null,
  );
});
