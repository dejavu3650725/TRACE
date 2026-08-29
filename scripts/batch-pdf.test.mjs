import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { STORAGE } from "../src/lib/config.ts";
import {
  BatchPageRangeValidationError,
  groupExtractedBatchPages,
  groupBatchPagesByStudent,
  normalizeBatchPageRanges,
} from "../src/features/artifacts/batch-ranges.ts";
import { validateTeacherArtifactFile } from "../src/features/artifacts/validation.ts";

const samplePath = new URL("../output/pdf/issue-28-synthetic-batch.pdf", import.meta.url);

test("synthetic Batch fixture is a valid 12-page PDF", async () => {
  const bytes = new Uint8Array(await readFile(samplePath));
  const result = await validateTeacherArtifactFile({
    name: "issue-28-synthetic-batch.pdf",
    size: bytes.byteLength,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  });
  assert.equal(result.mimeType, "application/pdf");
  assert.equal(result.pageCount, 12);
});

test("accepts mixed 1, 2 and 3-page groups and sorts them", () => {
  assert.deepEqual(normalizeBatchPageRanges([
    { page_start: 10, page_end: 12 },
    { page_start: 3, page_end: 3 },
    { page_start: 1, page_end: 2 },
    { page_start: 4, page_end: 6 },
    { page_start: 9, page_end: 9 },
    { page_start: 7, page_end: 8 },
  ], 12), [
    { page_start: 1, page_end: 2 },
    { page_start: 3, page_end: 3 },
    { page_start: 4, page_end: 6 },
    { page_start: 7, page_end: 8 },
    { page_start: 9, page_end: 9 },
    { page_start: 10, page_end: 12 },
  ]);
});

test("allows intentional gaps for separator or cover pages", () => {
  assert.deepEqual(normalizeBatchPageRanges([
    { page_start: 2, page_end: 3 },
    { page_start: 5, page_end: 5 },
  ], 6), [
    { page_start: 2, page_end: 3 },
    { page_start: 5, page_end: 5 },
  ]);
});

test("groups an 8-page PDF into two 4-page student packets", () => {
  assert.deepEqual(groupBatchPagesByStudent(8, 4), [
    { page_start: 1, page_end: 4 },
    { page_start: 5, page_end: 8 },
  ]);
});

test("checks every page identity and separates different students", () => {
  const question = (questionId, rawText) => ({
    questionId,
    visiblePrompt: null,
    responseType: "short_text",
    response: { raw_text: rawText },
    uncertain: false,
  });
  const identity = (studentNumber, studentName) => ({
    grade: "3",
    className: "1",
    studentNumber,
    studentName,
    uncertain: false,
  });

  assert.deepEqual(groupExtractedBatchPages([
    { page: 1, identity: identity("4", "김겸율"), questions: [question("Q1", "첫 답안")] },
    { page: 2, identity: identity("20", "유마루"), questions: [question("Q1", "둘째 답안")] },
  ]).map(({ pageStart, pageEnd, identity: pageIdentity }) => ({
    pageStart,
    pageEnd,
    studentNumber: pageIdentity.studentNumber,
  })), [
    { pageStart: 1, pageEnd: 1, studentNumber: "4" },
    { pageStart: 2, pageEnd: 2, studentNumber: "20" },
  ]);
});

test("joins only consecutive pages with the same independently visible identity", () => {
  const identity = {
    grade: "3",
    className: "1",
    studentNumber: "4",
    studentName: "김겸율",
    uncertain: false,
  };
  const packets = groupExtractedBatchPages([
    { page: 1, identity, questions: [{ questionId: "Q1", visiblePrompt: null, responseType: "short_text", response: { raw_text: "가" }, uncertain: false }] },
    { page: 2, identity, questions: [{ questionId: "Q2", visiblePrompt: null, responseType: "short_text", response: { raw_text: "나" }, uncertain: false }] },
    { page: 3, identity: { ...identity, uncertain: true }, questions: [{ questionId: "Q3", visiblePrompt: null, responseType: "short_text", response: { raw_text: "다" }, uncertain: false }] },
  ]);
  assert.equal(packets.length, 2);
  assert.deepEqual([packets[0].pageStart, packets[0].pageEnd], [1, 2]);
  assert.deepEqual([packets[1].pageStart, packets[1].pageEnd], [3, 3]);
});

test("rejects overlapping page ranges", () => {
  assert.throws(
    () => normalizeBatchPageRanges([
      { page_start: 1, page_end: 4 },
      { page_start: 4, page_end: 6 },
    ], 12),
    (error) => error instanceof BatchPageRangeValidationError && /겹칠/.test(error.message),
  );
});

test("rejects reversed and out-of-source ranges", () => {
  assert.throws(() => normalizeBatchPageRanges([{ page_start: 5, page_end: 4 }], 12));
  assert.throws(() => normalizeBatchPageRanges([{ page_start: 12, page_end: 13 }], 12));
});

test("uses a UUID-only Batch Storage path", () => {
  const path = STORAGE.teacherBatchOriginalPath(
    "00000000-0000-4000-8000-000000002811",
    "00000000-0000-4000-8000-000000002821",
  );
  assert.equal(path, "teachers/00000000-0000-4000-8000-000000002811/batches/00000000-0000-4000-8000-000000002821/original/00000000-0000-4000-8000-000000002821.pdf");
  assert.equal(path.includes("student"), false);
});
