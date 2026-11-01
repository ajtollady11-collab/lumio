import { z } from "zod";

/** Shape of public.get_tutor_quota(). */
export const quotaSchema = z.object({
  planId: z.string(),
  allowance: z.coerce.number(),
  usedThisMonth: z.coerce.number(),
  complexUsedThisMonth: z.coerce.number(),
  lastMinute: z.coerce.number(),
  lastHour: z.coerce.number(),
});
export type Quota = z.infer<typeof quotaSchema>;

/** Abuse protection independent of the plan allowance. */
export const RATE_LIMITS = { perMinute: 6, perHour: 60 } as const;

export type QuotaDecision =
  { ok: true; remaining: number } | { ok: false; code: "rate_limited" | "allowance_exhausted"; message: string };

export function checkQuota(q: Quota): QuotaDecision {
  if (q.lastMinute >= RATE_LIMITS.perMinute)
    return {
      ok: false,
      code: "rate_limited",
      message: "That's a lot of messages in a minute — take a breath and try again shortly.",
    };
  if (q.lastHour >= RATE_LIMITS.perHour)
    return {
      ok: false,
      code: "rate_limited",
      message: "You've reached the hourly message limit. Have a break and come back soon.",
    };
  const remaining = q.allowance - q.usedThisMonth;
  if (remaining <= 0)
    return {
      ok: false,
      code: "allowance_exhausted",
      message:
        q.planId === "free"
          ? `You've used all ${q.allowance} tutor messages on the free plan this month. They reset on the 1st.`
          : `You've used this month's ${q.allowance} tutor messages. They reset on the 1st.`,
    };
  return { ok: true, remaining };
}
