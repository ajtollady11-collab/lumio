import "server-only";
import Anthropic, { APIError, APIUserAbortError } from "@anthropic-ai/sdk";
import type { TokenUsage } from "@/lib/ai/models";
import { requireServerEnv } from "@/lib/config/server-env";

/*
 * Provider abstraction. The tutor talks to `ChatProvider`, never to a vendor
 * SDK, so adding OpenAI (or swapping models) touches only this file.
 */

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatProviderRequest = {
  model: string;
  /** System blocks in order. `cache: true` marks a stable prefix for prompt caching. */
  system: { text: string; cache?: boolean }[];
  messages: ChatTurn[];
  maxTokens: number;
  signal?: AbortSignal;
};

export type ChatChunk =
  | { type: "text"; text: string }
  | { type: "end"; usage: TokenUsage; requestId: string | null; stopReason: string | null };

export type ProviderErrorKind =
  "auth" | "rate_limited" | "overloaded" | "bad_request" | "aborted" | "network" | "unknown";

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export interface ChatProvider {
  readonly id: "anthropic";
  stream(request: ChatProviderRequest): AsyncIterable<ChatChunk>;
}

export function createAnthropicProvider(apiKey = requireServerEnv("ANTHROPIC_API_KEY")): ChatProvider {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 });
  return {
    id: "anthropic",
    async *stream(req) {
      try {
        const stream = client.messages.stream(
          {
            model: req.model,
            max_tokens: req.maxTokens,
            system: req.system.map((b) => ({
              type: "text" as const,
              text: b.text,
              ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
            })),
            messages: req.messages,
          },
          { signal: req.signal },
        );
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            yield { type: "text", text: event.delta.text };
          }
        }
        const final = await stream.finalMessage();
        yield {
          type: "end",
          usage: {
            inputTokens: final.usage.input_tokens,
            outputTokens: final.usage.output_tokens,
            cacheWriteTokens: final.usage.cache_creation_input_tokens ?? 0,
            cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
          },
          requestId: final.id,
          stopReason: final.stop_reason,
        };
      } catch (error) {
        throw toProviderError(error);
      }
    },
  };
}

function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof APIUserAbortError) return new ProviderError("aborted", "Request aborted");
  if (error instanceof APIError) {
    const status = error.status ?? 0;
    if (status === 401 || status === 403) return new ProviderError("auth", `Provider rejected credentials (${status})`);
    if (status === 429) return new ProviderError("rate_limited", "Provider rate limit");
    if (status === 529 || status >= 500) return new ProviderError("overloaded", `Provider unavailable (${status})`);
    if (status === 400 || status === 404)
      return new ProviderError("bad_request", `Provider rejected request (${status})`);
    if (!status) return new ProviderError("network", "Provider unreachable");
  }
  if (error instanceof Error && error.name === "AbortError") return new ProviderError("aborted", "Request aborted");
  return new ProviderError("unknown", error instanceof Error ? error.message : "Unknown provider error");
}
