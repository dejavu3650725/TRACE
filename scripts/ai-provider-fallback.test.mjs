import assert from "node:assert/strict";
import test from "node:test";
import {
  createFallbackVlmAdapter,
  createMediaPreferredVlmAdapter,
} from "../src/lib/ai/fallback-vlm-adapter.ts";
import { createPrivacySafeVlmRequest } from "../src/lib/ai/privacy-context.ts";
import { createUpstageAdapter } from "../src/lib/ai/upstage-adapter.ts";
import { getVlmAdapter } from "../src/lib/ai/vlm-adapter.ts";

const meta = (provider, model) => ({
  requestId: "synthetic-request",
  provider,
  model,
  durationMs: 1,
  retryCount: 0,
});

test("configured Upstage key enables the shared fallback adapter", () => {
  const previousKey = process.env.UPSTAGE_API_KEY;
  const previousModel = process.env.UPSTAGE_MODEL;
  process.env.UPSTAGE_API_KEY = "up_synthetic_config_key";
  process.env.UPSTAGE_MODEL = "synthetic-solar";
  try {
    const adapter = getVlmAdapter();
    assert.equal(adapter.provider, "fallback");
    assert.equal(adapter.model.includes("synthetic-solar"), true);
  } finally {
    if (previousKey === undefined) delete process.env.UPSTAGE_API_KEY;
    else process.env.UPSTAGE_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.UPSTAGE_MODEL;
    else process.env.UPSTAGE_MODEL = previousModel;
  }
});

test("PDF and image requests use Upstage before Gemini", async () => {
  const calls = [];
  const gemini = {
    provider: "google",
    model: "synthetic-gemini",
    async generate() {
      calls.push("gemini");
      return { ok: true, outputText: "gemini", meta: meta("google", "synthetic-gemini") };
    },
  };
  const upstage = {
    provider: "upstage",
    model: "synthetic-solar",
    async generate() {
      calls.push("upstage");
      return { ok: true, outputText: "upstage", meta: meta("upstage", "synthetic-solar") };
    },
  };
  const result = await createMediaPreferredVlmAdapter(gemini, upstage).generate(
    createPrivacySafeVlmRequest({
      purpose: "VLM_SMOKE_TEST",
      prompt: "합성 PDF 우선순위 요청",
      media: [{ mimeType: "application/pdf", base64: "aGVsbG8=" }],
    }),
  );
  assert.equal(result.ok, true);
  assert.equal(result.meta.provider, "upstage");
  assert.deepEqual(calls, ["upstage"]);
});

test("media request falls back to Gemini only after Upstage fails", async () => {
  const calls = [];
  const gemini = {
    provider: "google",
    model: "synthetic-gemini",
    async generate() {
      calls.push("gemini");
      return { ok: true, outputText: "gemini", meta: meta("google", "synthetic-gemini") };
    },
  };
  const upstage = {
    provider: "upstage",
    model: "synthetic-solar",
    async generate() {
      calls.push("upstage");
      return {
        ok: false,
        error: { code: "PROVIDER_UNAVAILABLE", message: "synthetic unavailable", retryable: true },
        meta: meta("upstage", "synthetic-solar"),
      };
    },
  };
  const result = await createMediaPreferredVlmAdapter(gemini, upstage).generate(
    createPrivacySafeVlmRequest({
      purpose: "VLM_SMOKE_TEST",
      prompt: "합성 PDF fallback 요청",
      media: [{ mimeType: "application/pdf", base64: "aGVsbG8=" }],
    }),
  );
  assert.equal(result.ok, true);
  assert.equal(result.meta.provider, "google");
  assert.deepEqual(calls, ["upstage", "gemini"]);
});

test("requests without media keep Gemini as the primary Provider", async () => {
  const calls = [];
  const gemini = {
    provider: "google",
    model: "synthetic-gemini",
    async generate() {
      calls.push("gemini");
      return { ok: true, outputText: "gemini", meta: meta("google", "synthetic-gemini") };
    },
  };
  const upstage = {
    provider: "upstage",
    model: "synthetic-solar",
    async generate() {
      calls.push("upstage");
      return { ok: true, outputText: "upstage", meta: meta("upstage", "synthetic-solar") };
    },
  };
  const result = await createMediaPreferredVlmAdapter(gemini, upstage).generate(
    createPrivacySafeVlmRequest({ purpose: "VLM_SMOKE_TEST", prompt: "합성 텍스트 요청" }),
  );
  assert.equal(result.ok, true);
  assert.equal(result.meta.provider, "google");
  assert.deepEqual(calls, ["gemini"]);
});

test("fallback uses Upstage once after a Gemini failure", async () => {
  let primaryCalls = 0;
  let secondaryCalls = 0;
  const primary = {
    provider: "google",
    model: "synthetic-gemini",
    async generate() {
      primaryCalls += 1;
      return {
        ok: false,
        error: { code: "RATE_LIMITED", message: "synthetic limit", retryable: true },
        meta: meta("google", "synthetic-gemini"),
      };
    },
  };
  const secondary = {
    provider: "upstage",
    model: "synthetic-solar",
    async generate() {
      secondaryCalls += 1;
      return { ok: true, outputText: "{\"ok\":true}", meta: meta("upstage", "synthetic-solar") };
    },
  };
  const result = await createFallbackVlmAdapter(primary, secondary).generate(
    createPrivacySafeVlmRequest({ purpose: "VLM_SMOKE_TEST", prompt: "합성 fallback 요청" }),
  );
  assert.equal(result.ok, true);
  assert.equal(result.meta.provider, "upstage");
  assert.equal(primaryCalls, 1);
  assert.equal(secondaryCalls, 1);
});

test("fallback never bypasses a privacy rejection", async () => {
  let secondaryCalls = 0;
  const primary = {
    provider: "google",
    model: "synthetic-gemini",
    async generate() {
      return {
        ok: false,
        error: { code: "PRIVACY_BLOCKED", message: "synthetic privacy rejection", retryable: false },
        meta: meta("google", "synthetic-gemini"),
      };
    },
  };
  const secondary = {
    provider: "upstage",
    model: "synthetic-solar",
    async generate() {
      secondaryCalls += 1;
      throw new Error("secondary must not run");
    },
  };
  const result = await createFallbackVlmAdapter(primary, secondary).generate(
    createPrivacySafeVlmRequest({ purpose: "VLM_SMOKE_TEST", prompt: "합성 privacy 요청" }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "PRIVACY_BLOCKED");
  assert.equal(secondaryCalls, 0);
});

test("Upstage adapter digitizes media then asks Solar without exposing the key", async () => {
  const previousFetch = globalThis.fetch;
  const secret = "up_synthetic_secret";
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("/document-digitization")) {
      return new Response(JSON.stringify({ content: { html: "<p>합성 문서 응답</p>" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: "{\"answer\":\"합성\"}" } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await createUpstageAdapter(secret, "solar-pro4").generate(
      createPrivacySafeVlmRequest({
        purpose: "VLM_SMOKE_TEST",
        prompt: "합성 문서에서 관찰 내용을 JSON으로 반환하세요.",
        media: [{ mimeType: "application/pdf", base64: "aGVsbG8=" }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: { type: "object", required: ["answer"], properties: { answer: { type: "string" } } },
        },
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(result.meta.provider, "upstage");
    assert.equal(requests.length, 2);
    assert.equal(requests[0].init.body.get("model"), "document-parse");
    assert.equal(requests[0].init.body.get("ocr"), "force");
    const chatBody = JSON.parse(requests[1].init.body);
    assert.equal(chatBody.model, "solar-pro4");
    assert.equal(chatBody.messages[0].content.includes("합성 문서 응답"), true);
    assert.equal(JSON.stringify(chatBody).includes(secret), false);
    assert.equal(new Headers(requests[1].init.headers).get("Authorization"), `Bearer ${secret}`);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
