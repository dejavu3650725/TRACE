import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleGeminiAdapter } from "../src/lib/ai/google-gemini-adapter.ts";
import {
  buildActivityDraftPrivacyContext,
  buildMaterialClassificationPrivacyContext,
  buildSubmissionAnalysisPrivacyContext,
  createPrivacySafeVlmRequest,
  PrivacyContextViolationError,
} from "../src/lib/ai/privacy-context.ts";

const safeActivitySource = {
  teacherPrompt: "3학년 국어 읽기 활동 초안을 만들어 주세요.",
  metadata: {
    schoolLevel: "초등학교",
    grade: 3,
    subject: "국어",
    domain: "읽기",
    unit: null,
    activityType: "활동지",
  },
  candidateStandards: [{
    id: "4국02-01",
    grade: "3~4학년",
    subject: "국어",
    domain: "읽기",
    description: "글의 의미를 파악한다.",
  }],
};

test("activity Privacy Context keeps only allowlisted fields", () => {
  const context = buildActivityDraftPrivacyContext({
    ...safeActivitySource,
    studentName: "합성학생가",
    studentNumber: 7,
    teacherEmail: "synthetic-teacher@example.test",
    googleAccount: { subject: "google-account-value" },
    roster: [{ name: "합성학생나" }],
    className: "합성 학급 표시명",
    studentId: "00000000-0000-4000-8000-000000002401",
    metadata: {
      ...safeActivitySource.metadata,
      teacherEmail: "nested@example.test",
      className: "3학년 합성반",
    },
    candidateStandards: safeActivitySource.candidateStandards.map((standard) => ({
      ...standard,
      studentName: "합성학생다",
    })),
  });

  assert.deepEqual(context, safeActivitySource);
  const serialized = JSON.stringify(context);
  for (const prohibited of [
    "합성학생가",
    "합성학생나",
    "합성학생다",
    "synthetic-teacher@example.test",
    "nested@example.test",
    "google-account-value",
    "00000000-0000-4000-8000-000000002401",
    "studentName",
    "studentNumber",
    "teacherEmail",
    "googleAccount",
    "roster",
    "className",
    "studentId",
  ]) {
    assert.equal(serialized.includes(prohibited), false, `${prohibited} must be excluded`);
  }
});

test("material classification Context excludes roster and identity fields", () => {
  const context = buildMaterialClassificationPrivacyContext({
    classContext: { grade: 3, className: "합성반" },
    pdf: { mimeType: "application/pdf", base64: "aGVsbG8=" },
    roster: [{ studentName: "합성학생" }],
    teacherEmail: "teacher@example.test",
  });
  assert.deepEqual(context, {
    classContext: { grade: 3 },
    pdf: { mimeType: "application/pdf", base64: "aGVsbG8=" },
  });
});

test("analysis Privacy Context excludes identity objects without reading roster data", () => {
  const context = buildSubmissionAnalysisPrivacyContext({
    structuredInput: {
      schema_version: "1",
      questions: [{
        question_id: "Q1",
        response_type: "short_text",
        response: { text: "중심 문장은 첫 문장이다." },
      }],
    },
    images: [{ mimeType: "image/png", base64: "aGVsbG8=" }],
    activity: { title: "중심 문장 찾기", description: null, className: "합성반" },
    standards: [{
      standard_id: "4국02-01",
      subject: "국어",
      grade_band: "3~4학년",
      text: "글의 의미를 파악한다.",
      achievement_levels: [{ level: "상", description: "의미를 정확히 파악한다." }],
      studentId: "00000000-0000-4000-8000-000000002402",
    }],
    previousApprovedEvidence: ["첫 문장을 중심 문장으로 표시함"],
    student: { name: "합성학생라", student_number: 4 },
    teacher: { email: "teacher@example.test" },
    otherStudents: [{ name: "합성학생마" }],
    roster: [{ name: "합성학생바" }],
  });

  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes("합성학생라"), false);
  assert.equal(serialized.includes("teacher@example.test"), false);
  assert.equal(serialized.includes("합성학생마"), false);
  assert.equal(serialized.includes("합성학생바"), false);
  assert.equal(serialized.includes("00000000-0000-4000-8000-000000002402"), false);
  assert.equal(context.structuredInput?.questions[0]?.response.text, "중심 문장은 첫 문장이다.");
});

test("Privacy Context blocks PII embedded inside an otherwise allowed field", () => {
  for (const teacherPrompt of [
    "김민수 학생을 위한 활동지를 만들어 주세요.",
    "교사 이메일 teacher@example.com으로 보내 주세요.",
    "3학년 1반 전용 활동지를 만들어 주세요.",
    "1번 학생에게 맞춘 활동지를 만들어 주세요.",
    "식별자 00000000-0000-4000-8000-000000002403을 사용하세요.",
  ]) {
    assert.throws(
      () => buildActivityDraftPrivacyContext({ ...safeActivitySource, teacherPrompt }),
      PrivacyContextViolationError,
    );
  }
});

test("Privacy Context blocks prohibited keys inside StructuredInput response", () => {
  assert.throws(
    () => buildSubmissionAnalysisPrivacyContext({
      structuredInput: {
        schema_version: "1",
        questions: [{
          question_id: "Q1",
          response_type: "short_text",
          response: { student_name: "합성학생사" },
        }],
      },
      images: [],
      activity: { title: "합성 활동", description: null },
      standards: [],
    }),
    PrivacyContextViolationError,
  );
});

test("Gemini adapter sends a sealed request with key in header only and normalized metadata", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = globalThis.fetch;
  const testKey = "issue-24-server-secret-test-value";
  let capturedUrl = "";
  let capturedInit;
  process.env.GEMINI_API_KEY = testKey;
  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "{\"synthetic\":true}" }] } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const adapter = createGoogleGeminiAdapter("synthetic-model");
    const result = await adapter.generate(createPrivacySafeVlmRequest({
      purpose: "VLM_SMOKE_TEST",
      prompt: "합성 이미지 요청입니다. JSON만 반환하세요.",
      media: [{ mimeType: "image/png", base64: "aGVsbG8=" }],
      generationConfig: { responseMimeType: "application/json" },
    }));

    assert.equal(result.ok, true);
    assert.equal(result.meta.provider, "google");
    assert.equal(result.meta.model, "synthetic-model");
    assert.equal(capturedUrl.includes(testKey), false);
    assert.equal(new Headers(capturedInit.headers).get("x-goog-api-key"), testKey);
    const sent = JSON.parse(String(capturedInit.body));
    assert.equal(sent.contents[0].parts[1].inlineData.mimeType, "image/png");
    assert.equal(JSON.stringify(result).includes(testKey), false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test("Gemini adapter never returns a raw Provider error body", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = globalThis.fetch;
  const providerBodySecret = "provider-raw-body-must-not-escape";
  process.env.GEMINI_API_KEY = "issue-24-error-test-key";
  globalThis.fetch = async () => new Response(providerBodySecret, { status: 400 });

  try {
    const result = await createGoogleGeminiAdapter("synthetic-model").generate(
      createPrivacySafeVlmRequest({
        purpose: "VLM_SMOKE_TEST",
        prompt: "합성 오류 정규화 테스트입니다.",
      }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "INVALID_REQUEST");
    assert.equal(JSON.stringify(result).includes(providerBodySecret), false);
    assert.equal(JSON.stringify(result).includes("issue-24-error-test-key"), false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test("Gemini adapter rejects unsealed requests before reading credentials", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const result = await createGoogleGeminiAdapter("synthetic-model").generate({
      purpose: "VLM_SMOKE_TEST",
      prompt: "unsealed",
      media: [],
      generationConfig: {},
      timeoutMs: 1_000,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "PRIVACY_BLOCKED");
  } finally {
    if (previousKey !== undefined) process.env.GEMINI_API_KEY = previousKey;
  }
});
