import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

/**
 * Data Access Layer for identity.
 *
 * Every Server Component, Server Action and Route Handler that needs the
 * current user goes through here. It verifies the JWT (getClaims validates the
 * signature against the project's keys) and returns a narrow, client-safe
 * object — never the raw session or tokens.
 */
export type Viewer = {
  id: string;
  email: string | null;
  role: Enums<"account_role">;
  displayName: string | null;
  onboarded: boolean;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, onboarding_completed_at")
    .eq("id", claims.sub)
    .maybeSingle();

  // A verified user without a profile row means the sign-up trigger failed;
  // treat as signed out rather than rendering a half-built account.
  if (!profile) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    role: profile.role,
    displayName: profile.display_name,
    onboarded: profile.onboarding_completed_at !== null,
  };
});

/** For protected pages: returns the viewer or redirects to sign-in. */
export async function requireViewer(next?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    redirect(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  }
  return viewer;
}

/** Sends each role to its own home. */
export function homeFor(role: Viewer["role"]): string {
  return role === "parent" ? "/parent" : "/app";
}
