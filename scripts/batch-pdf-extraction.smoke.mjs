import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractBatchPdfWithVlm } from "../src/lib/ai/batch-pdf-extraction.ts";
import { getVlmAdapter } from "../src/lib/ai/vlm-adapter.ts";

const pdf = await readFile("output/pdf/issue-29-synthetic-shuffled-batch.pdf");
const expected = [
  { number: "3", name: "최하린", q1: "3/5", q2: "분모가 같을 때 분자가 3인 분수가 더 큽니다." },
  { number: "1", name: "강서윤", q1: "3/5", q2: "5칸 중 3칸이 2칸보다 더 많기 때문입니다." },
  { number: "4", name: "김겸율", q1: "3/5", q2: "두 분수의 분모가 같고 3이 2보다 큽니다." },
  { number: "2", name: "박도윤", q1: "3/5", q2: "같은 크기로 나눈 조각을 3개 고른 쪽이 더 큽니다." },
];
const adapter = getVlmAdapter();
const groups = await extractBatchPdfWithVlm({
  activity: {
    title: "분모가 같은 분수의 크기 비교",
    description: "합성 활동지에서 관찰 가능한 응답을 추출합니다.",
    grade: 3,
    questions: [
      { questionId: "Q1", prompt: "3/5와 2/5 중 더 큰 분수를 쓰세요.", responseType: "short_text", options: [] },
      { questionId: "Q2", prompt: "그렇게 생각한 이유를 한 문장으로 쓰세요.", responseType: "long_text", options: [] },
    ],
  },
  pageRanges: expected.map((_, rangeIndex) => ({
    rangeIndex,
    pageStart: rangeIndex + 1,
    pageEnd: rangeIndex + 1,
  })),
  pdfBase64: pdf.toString("base64"),
}, adapter);

assert.equal(groups.length, expected.length);
let exactIdentityCount = 0;
let exactAnswerCount = 0;
for (const [rangeIndex, oracle] of expected.entries()) {
  const group = groups.find((item) => item.rangeIndex === rangeIndex);
  assert.ok(group, `Range ${rangeIndex} must be returned`);
  if (
    group.identity.grade === "3"
    && group.identity.className === "1"
    && group.identity.studentNumber === oracle.number
    && group.identity.studentName === oracle.name
    && group.identity.uncertain === false
  ) exactIdentityCount += 1;

  const q1 = group.questions.find((question) => question.questionId === "Q1");
  const q2 = group.questions.find((question) => question.questionId === "Q2");
  if (
    q1?.response.raw_text === oracle.q1
    && q2?.response.raw_text === oracle.q2
    && q1.uncertain === false
    && q2.uncertain === false
  ) exactAnswerCount += 1;
}
assert.equal(exactIdentityCount, expected.length, "Every synthetic identity must be transcribed exactly");
assert.equal(exactAnswerCount, expected.length, "Every synthetic answer must be transcribed exactly");

console.log(JSON.stringify({
  provider: adapter.provider,
  model: adapter.model,
  ranges: groups.length,
  exactIdentityCount,
  exactAnswerCount,
  pageOrder: "3-1-4-2",
}, null, 2));
