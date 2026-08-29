import assert from "node:assert/strict";
import { rankExistingActivityCandidates } from "../src/features/activities/material-candidate-matching.ts";

const metadata = {
  title: "분수 크기 비교 활동지",
  grade: 3,
  subject: "수학",
  domain: "수와 연산",
  unit: "분수",
  activityType: "활동지",
  standardIds: ["4수01-11"],
};
const candidates = rankExistingActivityCandidates(metadata, [
  { id: "same", ...metadata },
  { id: "similar", ...metadata, title: "분수 연습", standardIds: [] },
  { id: "unrelated", title: "시 쓰기", grade: 5, subject: "국어", domain: "문학", unit: "시", activityType: "활동지", standardIds: [] },
]);

assert.equal(candidates[0]?.id, "same", "clear existing Activity ranks first");
assert.ok(candidates.some((candidate) => candidate.id === "similar"), "metadata similarity remains a candidate");
assert.ok(!candidates.some((candidate) => candidate.id === "unrelated"), "unrelated Activity is not forced into candidates");
console.log("material Activity candidate tests: 3/3 passed");
