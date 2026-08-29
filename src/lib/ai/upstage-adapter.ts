import "server-only";

import type {
  VlmAdapter,
  VlmAdapterErrorCode,
  VlmAdapterMetadata,
  VlmAdapterResult,
  VlmMediaPart,
} from "./contracts.ts";
import { isPrivacySafeVlmRequest, type PrivacySafeVlmRequest } from "./privacy-context.ts";

const UPSTAGE_DOCUMENT_ENDPOINT = "https://api.upstage.ai/v1/document-digitization";
const UPSTAGE_CHAT_ENDPOINT = "https://api.upstage.ai/v1/chat/completions";
const MAX_PARSED_DOCUMENT_CHARS = 300_000;

function metadata(model: string, requestId: string, startedAt: number): VlmAdapterMetadata {
  return {
    requestId,
    provider: "upstage",
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
  return { ok: false, error: { code, message, retryable }, meta: metadata(model, requestId, startedAt) };
}

function httpError(status: number) {
  if (status === 401 || status === 403) {
    return { code: "AUTHENTICATION_FAILED" as const, message: "Upstage authentication failed", retryable: false };
  }
  if (status === 429) {
    return { code: "RATE_LIMITED" as const, message: "Upstage rate limit was reached", retryable: true };
  }
  if (status >= 500) {
    return { code: "PROVIDER_UNAVAILABLE" as const, message: "Upstage is temporarily unavailable", retryable: true };
  }
  return { code: "INVALID_REQUEST" as const, message: "Upstage rejected the request", retryable: false };
}

function fileExtension(mimeType: string): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function collectParsedText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const chunks: string[] = [];
  const add = (value: unknown) => {
    if (typeof value === "string" && value.trim()) chunks.push(value.trim());
  };
  const content = record.content;
  if (content && typeof content === "object") {
    const contentRecord = content as Record<string, unknown>;
    add(contentRecord.text);
    add(contentRecord.markdown);
    add(contentRecord.html);
  }
  add(record.text);
  add(record.markdown);
  add(record.html);
  if (Array.isArray(record.elements)) {
    for (const element of record.elements) {
      if (!element || typeof element !== "object") continue;
      const elementRecord = element as Record<string, unknown>;
      add(elementRecord.text);
      add(elementRecord.html);
      if (elementRecord.content && typeof elementRecord.content === "object") {
        const elementContent = elementRecord.content as Record<string, unknown>;
        add(elementContent.text);
        add(elementContent.markdown);
        add(elementContent.html);
      }
    }
  }
  if (chunks.length === 0) return null;
  return [...new Set(chunks)].join("\n").slice(0, MAX_PARSED_DOCUMENT_CHARS);
}

async function digitizeMedia(
  media: VlmMediaPart,
  apiKey: string,
  timeoutMs: number,
): Promise<{ ok: true; text: string } | { ok: false; status: number | null }> {
  const bytes = Uint8Array.from(Buffer.from(media.base64, "base64"));
  const form = new FormData();
  form.append("document", new Blob([bytes], { type: media.mimeType }), `trace-document.${fileExtension(media.mimeType)}`);
  form.append("ocr", "force");
  form.append("model", "document-parse");
  const response = await fetch(UPSTAGE_DOCUMENT_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) return { ok: false, status: response.status };
  const text = collectParsedText(await response.json());
  return text ? { ok: true, text } : { ok: false, status: null };
}

export function createUpstageAdapter(apiKey: string, model: string): VlmAdapter {
  return {
    provider: "upstage",
    model,
    async generate(request: PrivacySafeVlmRequest): Promise<VlmAdapterResult> {
      const requestId = crypto.randomUUID();
      const startedAt = performance.now();
      if (!isPrivacySafeVlmRequest(request)) {
        return failed(model, requestId, startedAt, "PRIVACY_BLOCKED", "AI privacy boundary rejected the request", false);
      }

      try {
        const parsedDocuments: string[] = [];
        for (const media of request.media) {
          const parsed = await digitizeMedia(media, apiKey, request.timeoutMs);
          if (!parsed.ok) {
            if (parsed.status === null) {
              return failed(model, requestId, startedAt, "INVALID_RESPONSE", "Upstage returned no document text", true);
            }
            const error = httpError(parsed.status);
            return failed(model, requestId, startedAt, error.code, error.message, error.retryable);
          }
          parsedDocuments.push(parsed.text);
        }

        const schemaInstruction = request.generationConfig.responseJsonSchema
          ? `\n\n[반드시 따를 출력 JSON Schema]\n${JSON.stringify(request.generationConfig.responseJsonSchema)}`
          : "";
        const documentInstruction = parsedDocuments.length > 0
          ? `\n\n[Upstage Document Parse 결과]\n${parsedDocuments.map((text, index) => `--- 문서 ${index + 1} ---\n${text}`).join("\n")}`
          : "";
        const response = await fetch(UPSTAGE_CHAT_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(request.timeoutMs),
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: `${request.prompt}${schemaInstruction}${documentInstruction}` }],
            temperature: request.generationConfig.temperature ?? 0,
            max_tokens: request.generationConfig.maxOutputTokens ?? 8_192,
          }),
        });
        if (!response.ok) {
          const error = httpError(response.status);
          return failed(model, requestId, startedAt, error.code, error.message, error.retryable);
        }
        const body = await response.json() as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const outputText = body.choices?.[0]?.message?.content?.trim() ?? "";
        if (!outputText) {
          return failed(model, requestId, startedAt, "INVALID_RESPONSE", "Upstage returned an empty response", true);
        }
        return { ok: true, outputText, meta: metadata(model, requestId, startedAt) };
      } catch (error) {
        if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
          return failed(model, requestId, startedAt, "TIMEOUT", "Upstage request timed out", true);
        }
        return failed(model, requestId, startedAt, "NETWORK_ERROR", "Upstage network request failed", true);
      }
    },
  };
}
