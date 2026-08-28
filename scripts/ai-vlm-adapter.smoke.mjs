import assert from "node:assert/strict";
import {
  buildActivityDraftPrivacyContext,
  createPrivacySafeVlmRequest,
} from "../src/lib/ai/privacy-context.ts";
import { getVlmAdapter } from "../src/lib/ai/vlm-adapter.ts";

// 1x1 synthetic PNG. No real Student data or metadata is present.
const syntheticPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=";
const context = buildActivityDraftPrivacyContext({
  teacherPrompt: "합성 이미지 연결 상태를 확인합니다.",
  metadata: {
    schoolLevel: "초등학교",
    grade: 3,
    subject: "국어",
    domain: "읽기",
    unit: null,
    activityType: "연결 테스트",
  },
  candidateStandards: [],
});
const request = createPrivacySafeVlmRequest({
  purpose: "VLM_SMOKE_TEST",
  prompt: `다음은 TRACE의 합성 VLM 연결 테스트입니다. 입력 맥락: ${JSON.stringify(context)}\n반드시 {"synthetic":true,"status":"ok"} 형태의 JSON만 반환하세요.`,
  media: [{ mimeType: "image/png", base64: syntheticPng }],
  generationConfig: {
    temperature: 0,
    maxOutputTokens: 128,
    responseMimeType: "application/json",
    responseJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["synthetic", "status"],
      properties: {
        synthetic: { type: "boolean" },
        status: { type: "string", enum: ["ok"] },
      },
    },
  },
  timeoutMs: 120_000,
});

const adapter = getVlmAdapter();
const result = await adapter.generate(request);
assert.equal(result.ok, true, result.ok ? undefined : `${result.error.code}: ${result.error.message}`);
assert.ok(result.outputText.trim().length > 0, "Provider must return a non-empty response");

console.log(JSON.stringify({
  provider: result.meta.provider,
  model: result.meta.model,
  durationMs: result.meta.durationMs,
  responseTextLength: result.outputText.length,
}, null, 2));
