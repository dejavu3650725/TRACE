import assert from "node:assert/strict";
import test from "node:test";
import { resolveProcessingScope } from "../src/features/results/processing-scope.ts";

const rows = [
  {
    assignmentId: "assignment-a1",
    activityLabel: "Activity A1",
    studentId: "student-1",
    studentLabel: "1번 Synthetic Student 1",
    submissionId: "submission-a1-s1",
    inputStatus: "READY_FOR_PROCESS",
    matchesCurrentFilter: true,
  },
  {
    assignmentId: "assignment-a1",
    activityLabel: "Activity A1",
    studentId: "student-2",
    studentLabel: "2번 Synthetic Student 2",
    submissionId: "submission-a1-s2",
    inputStatus: "REVIEW_PENDING",
    matchesCurrentFilter: true,
  },
  {
    assignmentId: "assignment-a1",
    activityLabel: "Activity A1",
    studentId: "student-3",
    studentLabel: "3번 Synthetic Student 3",
    submissionId: null,
    inputStatus: null,
    matchesCurrentFilter: true,
  },
  {
    assignmentId: "assignment-a2",
    activityLabel: "Activity A2",
    studentId: "student-1",
    studentLabel: "1번 Synthetic Student 1",
    submissionId: "submission-a2-s1",
    inputStatus: "READY_FOR_PROCESS",
    matchesCurrentFilter: true,
  },
  {
    assignmentId: "assignment-a2",
    activityLabel: "Activity A2",
    studentId: "student-2",
    studentLabel: "2번 Synthetic Student 2",
    submissionId: "submission-a2-s2",
    inputStatus: "STORED",
    matchesCurrentFilter: false,
  },
];

test("whole Activity counts every result but hands off READY_FOR_PROCESS IDs only", () => {
  assert.deepEqual(resolveProcessingScope(rows, {
    mode: "activity",
    assignmentId: "assignment-a1",
  }), {
    total: 3,
    ready: 1,
    notEligible: 2,
    submissionIds: ["submission-a1-s1"],
  });
});

test("one Student resolves that Student's ready submissions across activities in stable order", () => {
  assert.deepEqual(resolveProcessingScope(rows, {
    mode: "student",
    studentId: "student-1",
  }).submissionIds, ["submission-a1-s1", "submission-a2-s1"]);
});

test("selected Students never silently include REVIEW_PENDING submissions", () => {
  const resolved = resolveProcessingScope(rows, {
    mode: "students",
    studentIds: ["student-1", "student-2"],
  });
  assert.equal(resolved.total, 4);
  assert.equal(resolved.ready, 2);
  assert.equal(resolved.notEligible, 2);
  assert.deepEqual(resolved.submissionIds, ["submission-a1-s1", "submission-a2-s1"]);
  assert.ok(!resolved.submissionIds.includes("submission-a1-s2"));
});

test("current filtered result set uses only rows marked by the active filters", () => {
  const resolved = resolveProcessingScope(rows, { mode: "filtered" });
  assert.equal(resolved.total, 4);
  assert.deepEqual(resolved.submissionIds, ["submission-a1-s1", "submission-a2-s1"]);
});

test("repeated resolution keeps explicit IDs deterministic and deduplicated", () => {
  const duplicatedRows = [...rows, rows[0]];
  const first = resolveProcessingScope(duplicatedRows, { mode: "filtered" });
  const second = resolveProcessingScope(duplicatedRows, { mode: "filtered" });
  assert.deepEqual(first.submissionIds, second.submissionIds);
  assert.deepEqual(first.submissionIds, ["submission-a1-s1", "submission-a2-s1"]);
});
