import "server-only";

import type { VlmAdapter } from "./contracts.ts";
import { createMediaPreferredVlmAdapter } from "./fallback-vlm-adapter.ts";
import { createGoogleGeminiAdapter } from "./google-gemini-adapter.ts";
import { getAiProviderConfig, getOptionalUpstageApiKey, getUpstageModel } from "./provider.ts";
import { createUpstageAdapter } from "./upstage-adapter.ts";

/** Single server-only Provider selection point for all TRACE AI/VLM Features. */
export function getVlmAdapter(): VlmAdapter {
  const config = getAiProviderConfig();
  switch (config.adapter) {
    case "gemini": {
      const primary = createGoogleGeminiAdapter(config.model);
      const upstageApiKey = getOptionalUpstageApiKey();
      return upstageApiKey
        ? createMediaPreferredVlmAdapter(primary, createUpstageAdapter(upstageApiKey, getUpstageModel()))
        : primary;
    }
  }
}
