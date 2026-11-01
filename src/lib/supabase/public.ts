import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/config/env";
import type { Database } from "@/types/database";

/**
 * Cookie-less client for public reference data (qualifications, boards,
 * subjects). Acts as the anonymous role, so only rows readable by everyone are
 * returned. Safe to use inside `"use cache"` functions because it reads no
 * request data.
 */
export function createSupabasePublicClient(): SupabaseClient<Database> {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error("Supabase is not configured.");
  return createClient<Database>(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
