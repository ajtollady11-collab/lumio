import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/config/env";
import { requireServerEnv } from "@/lib/config/server-env";
import type { Database } from "@/types/database";

/**
 * Privileged Supabase client using the secret key. BYPASSES Row Level Security.
 *
 * Use only in trusted server code for operations that must not be performed
 * as the user: Stripe webhooks, usage accounting, admin tooling, scheduled
 * reports. Every call site must do its own authorisation first and should
 * write an audit_logs entry for sensitive changes.
 */
export function createSupabaseAdminClient(): SupabaseClient<Database> {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error("Supabase URL is not configured.");
  return createClient<Database>(config.url, requireServerEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
