import { z } from "zod";

/**
 * Public environment — safe to ship to the browser.
 * Only NEXT_PUBLIC_* variables belong here. Next.js inlines them at build time,
 * so each one must be referenced explicitly (no dynamic process.env access).
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20).optional(),
  // Set to "true" once the Google provider is enabled in Supabase Auth.
  NEXT_PUBLIC_AUTH_GOOGLE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type PublicEnv = z.infer<typeof publicSchema>;

function readPublicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse({
    // Preview deployments have no fixed domain: fall back to the deployment's own URL (set by Vercel).
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : undefined),
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
    NEXT_PUBLIC_AUTH_GOOGLE_ENABLED: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Invalid public environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export const publicEnv = readPublicEnv();

export type SupabasePublicConfig = { url: string; publishableKey: string };

/** Returns the Supabase public config, or null when it has not been provided yet. */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey } = publicEnv;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export const isSupabaseConfigured = getSupabasePublicConfig() !== null;
