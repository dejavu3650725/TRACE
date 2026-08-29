import "server-only";

import type { VlmAdapter } from "./contracts.ts";
import { createGoogleGeminiAdapter } from "./google-gemini-adapter.ts";
import { getAiProviderConfig } from "./provider.ts";

/** Single server-only Provider selection point for all TRACE AI/VLM Features. */
export function getVlmAdapter(): VlmAdapter {
  const config = getAiProviderConfig();
  switch (config.adapter) {
    case "gemini":
      return createGoogleGeminiAdapter(config.model);
  }
}
