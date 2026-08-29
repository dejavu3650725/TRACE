import assert from "node:assert/strict";
import test from "node:test";
import {
  analysisJobFinalStatus,
  isProcessingJobActive,
  isProcessingJobTerminal,
  safeProcessingJobErrorMessage,
} from "../src/features/process/job-state.ts";

test("QUEUED and PROCESSING remain pollable active states", () => {
  assert.equal(isProcessingJobActive("QUEUED"), true);
  assert.equal(isProcessingJobActive("PROCESSING"), true);
  assert.equal(isProcessingJobTerminal("QUEUED"), false);
  assert.equal(isProcessingJobTerminal("PROCESSING"), false);
});

test("REVIEW_REQUIRED, COMPLETED, and FAILED stop polling as persisted final states", () => {
  for (const status of ["REVIEW_REQUIRED", "COMPLETED", "FAILED"]) {
    assert.equal(isProcessingJobActive(status), false);
    assert.equal(isProcessingJobTerminal(status), true);
  }
});

test("one failed item does not fail a partially successful analysis Job", () => {
  assert.equal(analysisJobFinalStatus(1, 1), "REVIEW_REQUIRED");
  assert.equal(analysisJobFinalStatus(19, 1), "REVIEW_REQUIRED");
});

test("all-item failure produces FAILED while successful results await Teacher review", () => {
  assert.equal(analysisJobFinalStatus(0, 2), "FAILED");
  assert.equal(analysisJobFinalStatus(2, 0), "REVIEW_REQUIRED");
});

test("persistent error text is generic and contains no Provider exception payload", () => {
  assert.equal(safeProcessingJobErrorMessage(0), null);
  assert.equal(safeProcessingJobErrorMessage(1), "일부 자료 분석에 실패했습니다.");
});
