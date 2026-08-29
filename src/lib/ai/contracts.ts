export type VlmPurpose = "ACTIVITY_DRAFT" | "SUBMISSION_ANALYSIS" | "VLM_SMOKE_TEST";

export type VlmProviderName = "google";

export type VlmMediaPart = Readonly<{
  mimeType: string;
  base64: string;
}>;

export type VlmGenerationConfig = Readonly<{
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: "application/json" | "text/plain";
  responseJsonSchema?: Record<string, unknown>;
}>;

export type VlmAdapterMetadata = Readonly<{
  requestId: string;
  provider: VlmProviderName;
  model: string;
  durationMs: number;
  retryCount: number;
}>;

export type VlmAdapterErrorCode =
  | "CONFIGURATION_ERROR"
  | "PRIVACY_BLOCKED"
  | "INVALID_REQUEST"
  | "AUTHENTICATION_FAILED"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE";

export type VlmAdapterResult =
  | Readonly<{
      ok: true;
      outputText: string;
      meta: VlmAdapterMetadata;
    }>
  | Readonly<{
      ok: false;
      error: Readonly<{
        code: VlmAdapterErrorCode;
        message: string;
        retryable: boolean;
      }>;
      meta: VlmAdapterMetadata;
    }>;

export interface VlmAdapter {
  readonly provider: VlmProviderName;
  readonly model: string;
  generate(request: import("./privacy-context.ts").PrivacySafeVlmRequest): Promise<VlmAdapterResult>;
}

/** Sanitized server-side error. Provider response bodies, prompts and secrets are never attached. */
export class VlmAdapterRequestError extends Error {
  readonly code: VlmAdapterErrorCode;
  readonly retryable: boolean;
  readonly meta: VlmAdapterMetadata;

  constructor(result: Extract<VlmAdapterResult, { ok: false }>) {
    super(result.error.message);
    this.name = "VlmAdapterRequestError";
    this.code = result.error.code;
    this.retryable = result.error.retryable;
    this.meta = result.meta;
  }
}
