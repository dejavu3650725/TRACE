import "server-only";

import type { VlmProviderName } from "./contracts.ts";

export type AiProviderConfig = Readonly<{
  adapter: "gemini";
  provider: VlmProviderName;
  model: string;
}>;

/**
 * Google AI Studio (Gemini) Adapter — 구현은 PROCESS 모듈에서 완성한다.
 * GEMINI_API_KEY는 서버 환경변수에서만 읽는다.
 */
export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았습니다. .env / Vercel 환경 변수를 확인하세요.",
    );
  }
  return key;
}

/** Stable Gemini model configured only on the server. */
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
}

/** Provider/model selection is configuration, not a Feature-level branch. */
export function getAiProviderConfig(): AiProviderConfig {
  const adapter = process.env.AI_PROVIDER ?? "gemini";
  if (adapter !== "gemini") {
    throw new Error(`Unsupported AI_PROVIDER: ${adapter}`);
  }

  return {
    adapter,
    provider: "google",
    model: getGeminiModel(),
  };
}
