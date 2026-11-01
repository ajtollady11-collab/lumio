import { DEFAULT_MODELS, type ModelTier } from "./models";

/*
 * Model routing for tutor chat. Default: the efficient model. Escalate to the
 * capable model only when there's a concrete reason AND the month's budget of
 * escalations isn't spent. Deterministic so it's testable and predictable
 * for cost.
 */

const STRUGGLE_PATTERNS = [
  /\b(i )?(still |really )?(don'?t|do not|didn'?t) (get|understand|follow)\b/i,
  /\b(still|so|really) confused\b/i,
  /\bconfus(ed|ing)\b/i,
  /\b(doesn'?t|does not|makes? no) (make )?sense\b/i,
  /\bi'?m (lost|stuck)\b/i,
  /\bexplain (it )?(again|differently|another way)\b/i,
  /\bwhat do you mean\b/i,
  /\bhuh\b|^\s*\?+\s*$/i,
];

/** True if the student's words signal they're struggling with the explanation. */
export function soundsStuck(text: string): boolean {
  return STRUGGLE_PATTERNS.some((p) => p.test(text));
}

export type RouteInput = {
  message: string;
  /** The student's previous messages in this conversation, most recent last. */
  previousUserMessages: string[];
  /** Escalations already used this month, and the month's budget for this plan. */
  complexUsed: number;
  complexBudget: number;
};

export type RouteDecision = { model: string; tier: ModelTier; reason: string; struggling: boolean };

export function routeTutorModel(input: RouteInput): RouteDecision {
  const struggling =
    soundsStuck(input.message) ||
    // Asking again right after being stuck counts too.
    (input.previousUserMessages.length > 0 &&
      soundsStuck(input.previousUserMessages.at(-1)!) &&
      input.message.length < 200);
  const long = input.message.length > 700;
  const budgetLeft = input.complexUsed < input.complexBudget;

  if ((struggling || long) && budgetLeft) {
    return {
      model: DEFAULT_MODELS.capable,
      tier: "capable",
      reason: struggling ? "student struggling" : "long question",
      struggling,
    };
  }
  return { model: DEFAULT_MODELS.efficient, tier: "efficient", reason: "default", struggling };
}

/** Monthly escalations to the capable model, per plan (≈10% of the message allowance). */
export const COMPLEX_BUDGET: Record<string, number> = { free: 5, premium: 100, family: 100 };
