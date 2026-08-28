import "server-only";

import type {
  VlmAdapter,
  VlmAdapterErrorCode,
  VlmAdapterMetadata,
  VlmAdapterResult,
} from "./contracts.ts";
import { isPrivacySafeVlmRequest, type PrivacySafeVlmRequest } from "./privacy-context.ts";
import { getGeminiApiKey } from "./provider.ts";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_INLINE_MEDIA_BYTES = 12 * 1024 * 1024;

function approximateDecodedBytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function metadata(model: string, requestId: string, startedAt: number): VlmAdapterMetadata {
  return {
    requestId,
    provider: "google",
    model,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    retryCount: 0,
  };
}

function failed(
  model: string,
  requestId: string,
  startedAt: number,
  code: VlmAdapterErrorCode,
  message: string,
  retryable: boolean,
): VlmAdapterResult {
  return {
    ok: false,
    error: { code, message, retryable },
    meta: metadata(model, requestId, startedAt),
  };
}

function httpError(status: number): Pick<Extract<VlmAdapterResult, { ok: false }>["error"], "code" | "message" | "retryable"> {
  if (status === 401 || status === 403) {
    return { code: "AUTHENTICATION_FAILED", message: "AI Provider authentication failed", retryable: false };
  }
  if (status === 429) {
    return { code: "RATE_LIMITED", message: "AI Provider rate limit was reached", retryable: true };
  }
  if (status >= 500) {
    return { code: "PROVIDER_UNAVAILABLE", message: "AI Provider is temporarily unavailable", retryable: true };
  }
  return { code: "INVALID_REQUEST", message: "AI Provider rejected the request", retryable: false };
}

export function createGoogleGeminiAdapter(model: string): VlmAdapter {
  return {
    provider: "google",
    model,
    async generate(request: PrivacySafeVlmRequest): Promise<VlmAdapterResult> {
      const requestId = crypto.randomUUID();
      const startedAt = performance.now();

      if (!isPrivacySafeVlmRequest(request)) {
        return failed(model, requestId, startedAt, "PRIVACY_BLOCKED", "AI privacy boundary rejected the request", false);
      }

      const totalMediaBytes = request.media.reduce(
        (total, media) => total + approximateDecodedBytes(media.base64),
        0,
      );
      if (totalMediaBytes > MAX_INLINE_MEDIA_BYTES) {
        return failed(model, requestId, startedAt, "INVALID_REQUEST", "AI inline media exceeds the safe request limit", false);
      }

      let apiKey: string;
      try {
        apiKey = getGeminiApiKey();
      } catch {
        return failed(model, requestId, startedAt, "CONFIGURATION_ERROR", "AI Provider is not configured", false);
      }

      try {
        const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          signal: AbortSignal.timeout(request.timeoutMs),
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: request.prompt },
                ...request.media.map((media) => ({
                  inlineData: { mimeType: media.mimeType, data: media.base64 },
                })),
              ],
            }],
            generationConfig: request.generationConfig,
          }),
        });

        if (!response.ok) {
          const error = httpError(response.status);
          return failed(model, requestId, startedAt, error.code, error.message, error.retryable);
        }

        let body: {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        try {
          body = await response.json() as typeof body;
        } catch {
          return failed(model, requestId, startedAt, "INVALID_RESPONSE", "AI Provider returned an invalid response", true);
        }

        const outputText = body.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("")
          .trim() ?? "";
        if (!outputText) {
          return failed(model, requestId, startedAt, "INVALID_RESPONSE", "AI Provider returned an empty response", true);
        }

        return {
          ok: true,
          outputText,
          meta: metadata(model, requestId, startedAt),
        };
      } catch (error) {
        if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
          return failed(model, requestId, startedAt, "TIMEOUT", "AI Provider request timed out", true);
        }
        return failed(model, requestId, startedAt, "NETWORK_ERROR", "AI Provider network request failed", true);
      }
    },
  };
}
