import assert from "node:assert/strict";
import test from "node:test";
import {
  activityContentFromAiDraft,
  AiActivityDraftSchema,
} from "../src/features/activities/ai-schema.ts";
import { containsProhibitedAiContext } from "../src/features/activities/ai-privacy.ts";
import { getActivityDraftAIProvider } from "../src/lib/ai/activity-provider.ts";
import { generateActivityDraftWithVlm } from "../src/lib/ai/activity-generation.ts";

const validDraft = {
  title: "중심 문장 찾기",
  description: "합성 데이터로 만든 읽기 활동",
  instructions: "글을 읽고 문항에 답하세요.",
  grade: 3,
  subject: "국어",
  domain: "읽기",
  unit: "중심 문장",
  activity_type: "활동지",
  standard_candidates: ["4국02-01"],
  questions: [
    {
      question_id: "Q1",
      prompt: "글의 중심 문장을 적으세요.",
      question_type: "SHORT_TEXT",
      options: [],
    },
    {
      question_id: "Q2",
      prompt: "중심 문장을 고르세요.",
      question_type: "MULTIPLE_CHOICE",
      options: ["첫 번째 문장", "두 번째 문장"],
    },
  ],
  print_layout_data: {
    paper_size: "A4",
    orientation: "PORTRAIT",
    estimated_pages: 1,
  },
};

test("AI Activity draft accepts the documented teacher-review shape", () => {
  assert.deepEqual(AiActivityDraftSchema.parse(validDraft), validDraft);
});

test("AI Activity draft rejects unsupported response types and invalid multiple choice", () => {
  assert.equal(
    AiActivityDraftSchema.safeParse({
      ...validDraft,
      questions: [{ ...validDraft.questions[0], question_type: "ACHIEVEMENT_LEVEL" }],
    }).success,
    false,
  );
  assert.equal(
    AiActivityDraftSchema.safeParse({
      ...validDraft,
      questions: [{ ...validDraft.questions[1], options: ["보기 하나"] }],
    }).success,
    false,
  );
});

test("AI Activity draft rejects duplicate Standard and question IDs", () => {
  assert.equal(
    AiActivityDraftSchema.safeParse({
      ...validDraft,
      standard_candidates: ["4국02-01", "4국02-01"],
    }).success,
    false,
  );
  assert.equal(
    AiActivityDraftSchema.safeParse({
      ...validDraft,
      questions: [validDraft.questions[0], { ...validDraft.questions[1], question_id: "Q1" }],
    }).success,
    false,
  );
  assert.equal(
    AiActivityDraftSchema.safeParse({
      ...validDraft,
      questions: [{ ...validDraft.questions[0], question_id: "Q2" }],
    }).success,
    false,
  );
});

test("persisted Activity content contains observable questions but no judgment fields", () => {
  const content = activityContentFromAiDraft(AiActivityDraftSchema.parse(validDraft));
  assert.equal(content.source, "AI_DRAFT");
  assert.equal(content.schema_version, "1");
  assert.equal(content.questions.length, 2);
  const serialized = JSON.stringify(content);
  for (const forbidden of ["achievement_level", "rubric", "strength", "difficulty", "feedback"]) {
    assert.equal(serialized.toLowerCase().includes(forbidden), false);
  }
});

test("AI context guard blocks likely PII but permits ordinary activity requests", () => {
  assert.equal(containsProhibitedAiContext("3학년 학생이 읽을 국어 활동지를 만들어 주세요."), false);
  assert.equal(containsProhibitedAiContext("김민수 학생을 위한 활동지를 만들어 주세요."), true);
  assert.equal(containsProhibitedAiContext("교사 이메일 teacher@example.com으로 보내 주세요."), true);
  assert.equal(containsProhibitedAiContext("student_number,student_name\n1,합성학생"), true);
  assert.equal(containsProhibitedAiContext("연락처는 010-1234-5678입니다."), true);
});

test("AI adapter rejects an unsupported provider instead of returning a fake draft", () => {
  const previous = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "unsupported-test-provider";
  try {
    assert.throws(() => getActivityDraftAIProvider(), /Unsupported AI_PROVIDER/);
  } finally {
    if (previous === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previous;
  }
});

test("Activity Feature reaches Provider only through a privacy-sealed request", async () => {
  let receivedRequest;
  const adapter = {
    provider: "google",
    model: "synthetic-model",
    async generate(request) {
      receivedRequest = request;
      return {
        ok: true,
        outputText: JSON.stringify(validDraft),
        meta: {
          requestId: "synthetic-request",
          provider: "google",
          model: "synthetic-model",
          durationMs: 1,
          retryCount: 0,
        },
      };
    },
  };

  const draft = await generateActivityDraftWithVlm({
    teacherPrompt: "3학년 국어 읽기 중심 문장 활동지를 만들어 주세요.",
    metadata: {
      schoolLevel: "초등학교",
      grade: 3,
      subject: "국어",
      domain: "읽기",
      unit: "중심 문장",
      activityType: "활동지",
    },
    candidateStandards: [{
      id: "4국02-01",
      grade: "3~4학년",
      subject: "국어",
      domain: "읽기",
      description: "글의 의미를 파악한다.",
    }],
  }, adapter);

  assert.equal(draft.title, validDraft.title);
  assert.equal(receivedRequest.purpose, "ACTIVITY_DRAFT");
  assert.equal(JSON.stringify(receivedRequest).includes("studentName"), false);
});
