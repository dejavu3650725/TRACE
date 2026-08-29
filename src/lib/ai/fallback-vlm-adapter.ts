import "server-only";

import type { VlmAdapter, VlmAdapterResult } from "./contracts.ts";
import type { PrivacySafeVlmRequest } from "./privacy-context.ts";

/** Uses the secondary Provider once for any primary failure except a privacy rejection. */
export function createFallbackVlmAdapter(primary: VlmAdapter, secondary: VlmAdapter): VlmAdapter {
  return {
    provider: "fallback",
    model: `${primary.model} → ${secondary.model}`,
    async generate(request: PrivacySafeVlmRequest): Promise<VlmAdapterResult> {
      const primaryResult = await primary.generate(request);
      if (primaryResult.ok || primaryResult.error.code === "PRIVACY_BLOCKED") return primaryResult;
      return secondary.generate(request);
    },
  };
}

/** Upstage reads PDF/images first; Gemini remains first for requests without media. */
export function createMediaPreferredVlmAdapter(gemini: VlmAdapter, upstage: VlmAdapter): VlmAdapter {
  return {
    provider: "fallback",
    model: `media: ${upstage.model} → ${gemini.model} / text: ${gemini.model} → ${upstage.model}`,
    async generate(request: PrivacySafeVlmRequest): Promise<VlmAdapterResult> {
      const [primary, secondary] = request.media.length > 0
        ? [upstage, gemini]
        : [gemini, upstage];
      const primaryResult = await primary.generate(request);
      if (primaryResult.ok || primaryResult.error.code === "PRIVACY_BLOCKED") return primaryResult;
      return secondary.generate(request);
    },
  };
}
