export type OpenAIRequestKind = "chat" | "report";

export type OpenAIIntegrationErrorCode =
  | "credential_missing"
  | "timeout"
  | "unavailable"
  | "empty_response"
  | "invalid_response";

export class OpenAIIntegrationError extends Error {
  readonly code: OpenAIIntegrationErrorCode;

  constructor(
    message: string,
    code: OpenAIIntegrationErrorCode
  ) {
    super(message);
    this.code = code;
  }
}

type OpenAIResponsePayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

export type OpenAIResponsesClientOptions = {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  logger?: (entry: Record<string, unknown>) => void;
};

type TextRequest = {
  kind: OpenAIRequestKind;
  instructions: string;
  input: string | Array<{ role: "user" | "assistant"; content: string }>;
  maxOutputTokens: number;
  format?: {
    type: "json_schema";
    name: string;
    strict: true;
    schema: Record<string, unknown>;
  };
};

function extractOutputText(payload: OpenAIResponsePayload): string | undefined {
  return payload.output_text || payload.output
    ?.flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text")?.text;
}

export class OpenAIResponsesClient {
  readonly model: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: (entry: Record<string, unknown>) => void;

  constructor(options: OpenAIResponsesClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.model = options.model || "gpt-5-mini";
    this.timeoutMs = options.timeoutMs || 20_000;
    this.fetchImpl = options.fetchImpl || fetch;
    this.logger = options.logger || ((entry) => console.info(JSON.stringify(entry)));
  }

  async requestText(request: TextRequest): Promise<string> {
    const startedAt = Date.now();
    let success = false;
    let errorCode: OpenAIIntegrationErrorCode | undefined;

    try {
      if (!this.apiKey) {
        throw new OpenAIIntegrationError("Falta configurar la credencial d'OpenAI.", "credential_missing");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            model: this.model,
            store: false,
            max_output_tokens: request.maxOutputTokens,
            instructions: request.instructions,
            input: request.input,
            ...(request.format ? { text: { format: request.format } } : {})
          }),
          signal: controller.signal
        });

        const payload = (await response.json()) as OpenAIResponsePayload;
        if (!response.ok) {
          throw new OpenAIIntegrationError("OpenAI no està disponible ara mateix.", "unavailable");
        }
        const output = extractOutputText(payload)?.trim();
        if (!output) {
          throw new OpenAIIntegrationError("OpenAI no ha retornat cap resposta.", "empty_response");
        }
        success = true;
        return output;
      } catch (error) {
        if (error instanceof OpenAIIntegrationError) throw error;
        if (error instanceof Error && error.name === "AbortError") {
          throw new OpenAIIntegrationError("OpenAI ha superat el temps d'espera.", "timeout");
        }
        throw new OpenAIIntegrationError("OpenAI no està disponible ara mateix.", "unavailable");
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      errorCode = error instanceof OpenAIIntegrationError ? error.code : "unavailable";
      throw error;
    } finally {
      this.logger({
        event: "openai_request",
        timestamp: new Date().toISOString(),
        requestType: request.kind,
        model: this.model,
        success,
        ...(errorCode ? { error: errorCode } : {}),
        latencyMs: Date.now() - startedAt
      });
    }
  }

  async requestStructured<T>(request: TextRequest & { format: NonNullable<TextRequest["format"]> }): Promise<T> {
    const output = await this.requestText(request);
    const normalized = output
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    try {
      return JSON.parse(normalized) as T;
    } catch {
      console.warn(JSON.stringify({
        event: "openai_invalid_structured_output",
        timestamp: new Date().toISOString(),
        requestType: request.kind,
        model: this.model,
        outputLength: normalized.length,
        startsWithObject: normalized.startsWith("{"),
        endsWithObject: normalized.endsWith("}")
      }));
      throw new OpenAIIntegrationError("OpenAI ha retornat un informe invàlid.", "invalid_response");
    }
  }
}
