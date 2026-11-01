import "server-only";
import { z } from "zod";

/**
 * Server-only secrets. Importing this module from a Client Component is a
 * build error (enforced by the "server-only" package).
 *
 * Every secret is optional at this stage so the app builds and runs before
 * each integration is connected. Call `requireServerEnv()` at the point of use:
 * it fails loudly and specifically when a needed secret is missing.
 */
const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  // Phase 3+ — AI providers
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  OPENAI_API_KEY: z.string().min(10).optional(),
  // Phase 7 — payments
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
});

type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || undefined,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || undefined,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || undefined,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Invalid server environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  cached = parsed.data;
  return cached;
}

export function requireServerEnv<K extends keyof ServerEnv>(key: K): NonNullable<ServerEnv[K]> {
  const value = getServerEnv()[key];
  if (value === undefined || value === null) {
    throw new Error(`Missing required server environment variable: ${key}. See .env.example.`);
  }
  return value as NonNullable<ServerEnv[K]>;
}
