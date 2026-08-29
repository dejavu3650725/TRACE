import assert from "node:assert/strict";
import test from "node:test";
import { selectMostRelevantMaterialStandard } from "../src/features/activities/ai-curriculum.ts";
import { classifyMaterialPdfWithVlm } from "../src/lib/ai/material-classification.ts";

const validOutput = JSON.stringify({
  title_candidate: "Synthetic Activity A4",
  description: "Synthetic activity description",
  instructions: "Read and answer the printed questions.",
  grade: 3,
  subject: "국어",
  domain: "읽기",
  unit: "문단의 짜임",
  activity_type: "활동지",
  pages_per_student: 1,
  keywords: ["문단", "짜임"],
  questions: [{
    question_id: "Q1",
    prompt: "Synthetic printed question",
    question_type: "SHORT_TEXT",
    options: [],
  }],
});

test("material classification requests strict structured JSON and validates it", async () => {
  let capturedRequest;
  const adapter = {
    provider: "google",
    model: "synthetic-model",
    async generate(request) {
      capturedRequest = request;
      return {
        ok: true,
        outputText: validOutput,
        meta: { requestId: "synthetic-request", provider: "google", model: "synthetic-model", durationMs: 1, retryCount: 0 },
      };
    },
  };

  const result = await classifyMaterialPdfWithVlm({ classGrade: 3, pdfBase64: "c3ludGhldGlj" }, adapter);
  assert.equal(result.title_candidate, "Synthetic Activity A4");
  assert.equal(result.pages_per_student, 1);
  assert.equal(capturedRequest.generationConfig.responseMimeType, "application/json");
  assert.equal(capturedRequest.generationConfig.responseJsonSchema.additionalProperties, false);
  assert.equal(capturedRequest.generationConfig.responseJsonSchema.properties.questions.maxItems, 20);
});

test("material classification retries one invalid model response", async () => {
  let attempt = 0;
  const adapter = {
    provider: "google",
    model: "synthetic-model",
    async generate() {
      attempt += 1;
      return {
        ok: true,
        outputText: attempt === 1 ? '{"title_candidate":"incomplete"}' : validOutput,
        meta: { requestId: `synthetic-${attempt}`, provider: "google", model: "synthetic-model", durationMs: 1, retryCount: 0 },
      };
    },
  };

  const result = await classifyMaterialPdfWithVlm({ classGrade: 3, pdfBase64: "c3ludGhldGlj" }, adapter);
  assert.equal(attempt, 2);
  assert.equal(result.questions.length, 1);
});

test("worksheet text selects the single most relevant curriculum standard", () => {
  const common = {
    schoolLevel: "초등학교",
    grade: "3~4학년",
    subject: "국어",
    unit: null,
    coreIdea: null,
    sourceFile: "synthetic.json",
  };
  const selected = selectMostRelevantMaterialStandard({
    standards: [
      { ...common, id: "4국02-02", domain: "읽기", description: "문단과 글에서 중심 생각을 파악하고 내용을 간추린다." },
      { ...common, id: "4국03-01", domain: "쓰기", description: "중심 문장과 뒷받침 문장을 갖추어 문단을 쓰고, 문장과 문단을 중심으로 고쳐 쓴다." },
      { ...common, id: "4국04-01", domain: "문법", description: "단어와 단어 사이의 의미 관계를 파악한다." },
    ],
    title: "문단 완성하기",
    description: "중심 문장과 뒷받침 문장을 이용해 한 문단을 완성하는 활동",
    instructions: "주어진 중심 문장에 알맞은 뒷받침 문장을 쓰세요.",
    domain: "쓰기",
    unit: "문단의 짜임",
    keywords: ["중심 문장", "뒷받침 문장", "문단"],
    questionPrompts: ["중심 문장에 어울리는 뒷받침 문장을 써서 문단을 완성하세요."],
  });

  assert.equal(selected?.id, "4국03-01");
});
