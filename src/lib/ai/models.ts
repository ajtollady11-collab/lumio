/*
 * Model catalogue and cost estimation.
 *
 * Prices are USD per million tokens for prompts under 100K tokens, taken from
 * published price tables on 2026-11-01 (see LUMIO_COST_CONTROL.md for
 * sources). They are ESTIMATES for internal cost tracking — the provider's
 * invoice is the source of truth. Update here when prices change.
 */

export type ModelTier = "efficient" | "capable";

export type ModelInfo = {
  id: string;
  provider: "anthropic";
  tier: ModelTier;
  inputPerMTok: number;
  outputPerMTok: number;
  cacheWritePerMTok: number;
  cacheReadPerMTok: number;
};

export const MODELS: Record<string, ModelInfo> = {
  "claude-haiku-5-5": {
    id: "claude-haiku-5-5",
    provider: "anthropic",
    tier: "efficient",
    inputPerMTok: 0.1,
    outputPerMTok: 0.5,
    cacheWritePerMTok: 0.125,
    cacheReadPerMTok: 0.01,
  },
  "claude-sonnet-5-5": {
    id: "claude-sonnet-5-5",
    provider: "anthropic",
    tier: "capable",
    inputPerMTok: 2,
    outputPerMTok: 10,
    cacheWritePerMTok: 2.5,
    cacheReadPerMTok: 0.1,
  },
};

export const DEFAULT_MODELS: Record<ModelTier, string> = {
  efficient: "claude-haiku-5-5",
  capable: "claude-sonnet-5-5",
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
};

/** Estimated cost in US-dollar micros (1 USD = 1,000,000). Unknown models cost 0 and are flagged by the caller. */
export function estimateCostMicros(modelId: string, u: TokenUsage): number {
  const m = MODELS[modelId];
  if (!m) return 0;
  const usd =
    (u.inputTokens * m.inputPerMTok +
      u.outputTokens * m.outputPerMTok +
      u.cacheWriteTokens * m.cacheWritePerMTok +
      u.cacheReadTokens * m.cacheReadPerMTok) /
    1_000_000;
  return Math.round(usd * 1_000_000);
}
