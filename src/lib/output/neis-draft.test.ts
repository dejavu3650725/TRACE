import assert from "node:assert/strict";
import test from "node:test";

const {
  calculateNeisBytes,
  findNeisReviewWarnings,
  isMeaningfullyEdited,
}: typeof import("./neis-draft") = await import("./neis-draft" + ".ts");

test("NEIS byte counting follows UTF-8 for Korean, ASCII, and line breaks", () => {
  assert.equal(calculateNeisBytes("가A1\n"), 6);
  assert.equal(calculateNeisBytes("2/4 = 4/8"), 9);
});

test("teacher edit check ignores whitespace-only changes", () => {
  assert.equal(isMeaningfullyEdited("근거를 기록함.", "  근거를   기록함.  "), false);
  assert.equal(isMeaningfullyEdited("근거를 기록함.", "근거를 구체적으로 기록함."), true);
});

test("review terms produce warnings instead of automatic deletion", () => {
  assert.deepEqual(findNeisReviewWarnings("교외 대회 수상 내용을 기록함."), [
    "“교외” 표현은 공식 기재요령과 학교 기준을 다시 확인하세요.",
    "“대회” 표현은 공식 기재요령과 학교 기준을 다시 확인하세요.",
    "“수상” 표현은 공식 기재요령과 학교 기준을 다시 확인하세요.",
  ]);
  assert.deepEqual(findNeisReviewWarnings("분수 모형의 관계를 설명함."), []);
});
