"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/config/env";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | null = null;

/**
 * Browser Supabase client. Uses only the publishable key; every query is
 * constrained by Row Level Security. Returns null until Supabase is configured.
 */
export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  browserClient ??= createBrowserClient<Database>(config.url, config.publishableKey);
  return browserClient;
}
