import "server-only";

import type { AiActivityDraft } from "../../features/activities/ai-schema.ts";
import type { VlmProviderName } from "./contracts.ts";
import {
  generateActivityDraftWithVlm,
  type ActivityDraftGenerationInput,
} from "./activity-generation.ts";
import { getVlmAdapter } from "./vlm-adapter.ts";

export interface ActivityDraftAIProvider {
  readonly provider: VlmProviderName;
  readonly model: string;
  generate(input: ActivityDraftGenerationInput): Promise<AiActivityDraft>;
}

/** Provider selection stays behind the shared server-only adapter boundary. */
export function getActivityDraftAIProvider(): ActivityDraftAIProvider {
  const adapter = getVlmAdapter();

  return {
    provider: adapter.provider,
    model: adapter.model,
    generate: (input) => generateActivityDraftWithVlm(input, adapter),
  };
}
