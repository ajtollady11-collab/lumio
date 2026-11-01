import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/config/env";
import type { Database } from "@/types/database";

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
    this.name = "SupabaseNotConfiguredError";
  }
}

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * Route Handlers. Acts as the signed-in user, so Row Level Security applies.
 *
 * Create a new client per request — never share one across requests.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient<Database>> {
  const config = getSupabasePublicConfig();
  if (!config) throw new SupabaseNotConfiguredError();

  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy (src/proxy.ts) refreshes the session on every request,
          // so it is safe to ignore here.
        }
      },
    },
  });
}
