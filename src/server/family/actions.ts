"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getViewerState, type Viewer } from "@/lib/auth/session";
import { failure, fromDatabaseError, success, type ActionResult, type Failure } from "@/lib/errors";
import { inviteCodeSchema, parentAboutSchema } from "@/lib/onboarding/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Parent ↔ student linking. Codes are created, checked and redeemed by
 * database functions (see migration 0007) that enforce role, expiry, single
 * use and a brute-force limit; these actions add session checks and
 * user-facing messages.
 */

type Ctx = { supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; viewer: Viewer };

async function context(role: Viewer["role"]): Promise<Ctx | Failure> {
  const state = await getViewerState();
  if (state.status === "unavailable") return failure("unavailable");
  if (state.status === "signed_out") return failure("session_expired");
  if (state.viewer.role !== role) return failure("forbidden");
  return { supabase: await createSupabaseServerClient(), viewer: state.viewer };
}

const isFailure = (x: unknown): x is Failure => typeof x === "object" && x !== null && (x as Failure).ok === false;

const INVITE_STATUS: Record<string, Failure> = {
  invalid_code: failure(
    "invalid",
    "That code isn't right. Check it with your parent — codes look like ABCD-EFGH-JKMN.",
    { code: "Check the code and try again." },
  ),
  code_expired: failure("invalid", "That code has expired. Ask your parent to create a new one.", {
    code: "This code has expired.",
  }),
  code_used: failure("invalid", "That code has already been used. Ask your parent for a new one.", {
    code: "This code has already been used.",
  }),
  rate_limited: failure("rate_limited", "Too many incorrect codes. Wait an hour, then try again."),
  already_linked: failure("duplicate", "You're already linked to this parent."),
};

// ---------------------------------------------------------------------------
// Parent
// ---------------------------------------------------------------------------

export async function saveParentAbout(input: unknown): Promise<ActionResult> {
  const ctx = await context("parent");
  if (isFailure(ctx)) return ctx;
  const parsed = parentAboutSchema.safeParse(input);
  if (!parsed.success) {
    return failure("invalid", parsed.error.issues[0]?.message, {
      [String(parsed.error.issues[0]?.path[0] ?? "form")]: parsed.error.issues[0]?.message ?? "",
    });
  }
  const { error } = await ctx.supabase
    .from("parent_profiles")
    .update({ first_name: parsed.data.firstName, weekly_report_opt_in: parsed.data.weeklyReportOptIn })
    .eq("profile_id", ctx.viewer.id);
  if (error) return fromDatabaseError(error);
  return success();
}

export async function completeParentOnboarding(): Promise<ActionResult> {
  const ctx = await context("parent");
  if (isFailure(ctx)) return ctx;
  const { error } = await ctx.supabase.rpc("complete_parent_onboarding");
  if (error) return fromDatabaseError(error);
  return success();
}

/** Creates a one-time code. The plain code is returned once and never stored. */
export async function createInvitation(): Promise<ActionResult<{ id: string; code: string; expiresAt: string }>> {
  const ctx = await context("parent");
  if (isFailure(ctx)) return ctx;
  const { data, error } = await ctx.supabase.rpc("create_parent_invitation");
  if (error) return fromDatabaseError(error);
  const row = data?.[0];
  if (!row) return failure("unknown");
  refresh();
  return success({ id: row.invitation_id, code: row.code, expiresAt: row.expires_at });
}

export async function revokeInvitation(invitationId: unknown): Promise<ActionResult> {
  const ctx = await context("parent");
  if (isFailure(ctx)) return ctx;
  const id = z.uuid().safeParse(invitationId);
  if (!id.success) return failure("invalid");
  const { error } = await ctx.supabase.rpc("revoke_parent_invitation", { p_invitation_id: id.data });
  if (error) return fromDatabaseError(error);
  refresh();
  return success();
}

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------

/** Shows who a code is from before the student approves it. */
export async function previewInvitation(
  code: unknown,
): Promise<ActionResult<{ parentName: string; expiresAt: string }>> {
  const ctx = await context("student");
  if (isFailure(ctx)) return ctx;
  const parsed = inviteCodeSchema.safeParse(code);
  if (!parsed.success)
    return failure("invalid", parsed.error.issues[0]?.message, { code: parsed.error.issues[0]?.message ?? "" });

  const { data, error } = await ctx.supabase.rpc("preview_parent_invitation", { p_code: parsed.data });
  if (error) return fromDatabaseError(error);
  const row = data?.[0];
  if (!row) return INVITE_STATUS.invalid_code;
  if (row.status !== "ok") return INVITE_STATUS[row.status] ?? failure("unknown");
  return success({ parentName: row.parent_first_name, expiresAt: row.expires_at });
}

export async function acceptInvitation(code: unknown): Promise<ActionResult> {
  const ctx = await context("student");
  if (isFailure(ctx)) return ctx;
  const parsed = inviteCodeSchema.safeParse(code);
  if (!parsed.success) return failure("invalid", parsed.error.issues[0]?.message);

  const { data, error } = await ctx.supabase.rpc("accept_parent_invitation", { p_code: parsed.data });
  if (error) return fromDatabaseError(error);
  const row = data?.[0];
  if (!row) return failure("unknown");
  if (row.status !== "ok") return INVITE_STATUS[row.status] ?? failure("unknown");
  refresh();
  return success();
}

const sharingSchema = z.object({
  linkId: z.uuid(),
  shareActivity: z.boolean(),
  shareResults: z.boolean(),
  shareConversations: z.boolean(),
});

/** Only the student can change what a linked parent sees (enforced by RLS). */
export async function updateSharing(input: unknown): Promise<ActionResult> {
  const ctx = await context("student");
  if (isFailure(ctx)) return ctx;
  const parsed = sharingSchema.safeParse(input);
  if (!parsed.success) return failure("invalid");
  const v = parsed.data;
  const { error, count } = await ctx.supabase
    .from("parent_student_links")
    .update(
      { share_activity: v.shareActivity, share_results: v.shareResults, share_conversations: v.shareConversations },
      { count: "exact" },
    )
    .eq("id", v.linkId)
    .eq("student_id", ctx.viewer.id);
  if (error) return fromDatabaseError(error);
  if (!count) return failure("not_found");
  return success();
}

// ---------------------------------------------------------------------------
// Either side
// ---------------------------------------------------------------------------

export async function unlink(linkId: unknown): Promise<ActionResult> {
  const state = await getViewerState();
  if (state.status === "unavailable") return failure("unavailable");
  if (state.status === "signed_out") return failure("session_expired");
  const id = z.uuid().safeParse(linkId);
  if (!id.success) return failure("invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("unlink_parent_student", { p_link_id: id.data });
  if (error) return fromDatabaseError(error);
  refresh();
  return success();
}
