import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/config/env";
import { isUnavailable } from "@/lib/errors";
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

/**
 * Distinguishes "not signed in" from "couldn't check". On the Supabase free
 * plan a project can be paused or briefly unreachable; treating that as signed
 * out would wrongly bounce people to the sign-in page.
 */
export type ViewerState =
  { status: "signed_in"; viewer: Viewer } | { status: "signed_out" } | { status: "unavailable" };

export const getViewerState = cache(async (): Promise<ViewerState> => {
  if (!isSupabaseConfigured) return { status: "signed_out" };

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error) {
      return isUnavailable({ message: error.message, status: error.status })
        ? { status: "unavailable" }
        : { status: "signed_out" };
    }
    if (!claims?.sub) return { status: "signed_out" };

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, display_name, onboarding_completed_at")
      .eq("id", claims.sub)
      .maybeSingle();

    if (profileError) {
      return isUnavailable(profileError) ? { status: "unavailable" } : { status: "signed_out" };
    }
    // A verified user without a profile means the sign-up trigger failed.
    if (!profile) return { status: "signed_out" };

    return {
      status: "signed_in",
      viewer: {
        id: claims.sub,
        email: typeof claims.email === "string" ? claims.email : null,
        role: profile.role,
        displayName: profile.display_name,
        onboarded: profile.onboarding_completed_at !== null,
      },
    };
  } catch {
    // Network-level failure (DNS, timeout, paused project).
    return { status: "unavailable" };
  }
});

export async function getViewer(): Promise<Viewer | null> {
  const state = await getViewerState();
  return state.status === "signed_in" ? state.viewer : null;
}

export class ServiceUnavailableError extends Error {
  constructor() {
    super("Lumio's database is temporarily unavailable.");
    this.name = "ServiceUnavailableError";
  }
}

/** For protected pages: returns the viewer, redirects when signed out, throws when unreachable. */
export async function requireViewer(next?: string): Promise<Viewer> {
  const state = await getViewerState();
  if (state.status === "unavailable") throw new ServiceUnavailableError();
  if (state.status === "signed_out") {
    redirect(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  }
  return state.viewer;
}

/** Sends each role to its own home. */
export function homeFor(role: Viewer["role"]): string {
  return role === "parent" ? "/parent" : "/app";
}
