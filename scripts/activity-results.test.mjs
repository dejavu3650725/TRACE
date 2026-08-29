import assert from "node:assert/strict";
import test from "node:test";
import {
  buildActivityResultCards,
  filterActivityResultCardsByTab,
} from "../src/features/results/activity-results.ts";

const students = Array.from({ length: 20 }, (_, index) => ({
  id: `student-${index + 1}`,
  studentNumber: index + 1,
  studentName: `Synthetic Student ${index + 1}`,
}));

function assignment(submissionCount) {
  return {
    assignmentId: "assignment-a1",
    activityId: "activity-a1",
    title: "Synthetic Activity A1",
    activityCode: "KOR-03-A1",
    grade: 3,
    subject: "국어",
    domain: "읽기",
    standardIds: ["[3국02-01]"],
    classId: "class-1",
    className: "3학년 1반",
    createdAt: "2026-08-20T00:00:00.000Z",
    students,
    submissions: students.slice(0, submissionCount).map((student, index) => ({
      id: `submission-${index + 1}`,
      studentId: student.id,
      inputStatus: index === 0 ? "REVIEW_PENDING" : "READY_FOR_PROCESS",
      processStatus: index === 0 ? "NOT_STARTED" : "READY_TO_ANALYZE",
      submittedAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
      artifactCount: 1,
    })),
  };
}

test("derives 18/20 and the two missing students from persisted submission existence", () => {
  const [card] = buildActivityResultCards([assignment(18)]);
  assert.equal(card.total, 20);
  assert.equal(card.submitted, 18);
  assert.equal(card.missing, 2);
  assert.deepEqual(card.rows.filter((row) => !row.submission).map((row) => row.student.studentNumber), [19, 20]);
});

test("the same query becomes 20/20 after the remaining submissions exist", () => {
  const [card] = buildActivityResultCards([assignment(20)]);
  assert.equal(card.submitted, 20);
  assert.equal(card.missing, 0);
});

test("tabs use real submission states", () => {
  const cards = buildActivityResultCards([assignment(18)]);
  assert.equal(filterActivityResultCardsByTab(cards, "review").length, 1);
  assert.equal(filterActivityResultCardsByTab(cards, "ready").length, 1);
});

test("PROCESS review state does not appear in the INPUT review tab", () => {
  const fixture = assignment(1);
  fixture.submissions[0].inputStatus = "READY_FOR_PROCESS";
  fixture.submissions[0].processStatus = "REVIEW_REQUIRED";
  const [card] = buildActivityResultCards([fixture]);
  assert.equal(card.reviewPending, 0);
  assert.equal(filterActivityResultCardsByTab([card], "review").length, 0);
});

test("activity search matches subject and title keywords", () => {
  const fixture = assignment(20);
  assert.equal(buildActivityResultCards([fixture], { keyword: "국어" }).length, 1);
  assert.equal(buildActivityResultCards([fixture], { keyword: "Synthetic Activity" }).length, 1);
  assert.equal(buildActivityResultCards([fixture], { keyword: "수학" }).length, 0);
});
