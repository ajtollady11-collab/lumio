"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getViewerState } from "@/lib/auth/session";
import { failure, fromDatabaseError, success, wrongAccount, type ActionResult } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Student controls over their learning memory. Every action re-verifies the
 * session and runs AS THE STUDENT: RLS (and column grants — students may only
 * change `status` and `student_note`) limit each write to their own rows, so
 * an id supplied by the browser can never reach another student's data.
 */

async function student(): Promise<string | ActionResult<never>> {
  const state = await getViewerState();
  if (state.status === "unavailable") return failure("unavailable");
  if (state.status === "signed_out") return failure("session_expired");
  if (state.viewer.role !== "student") return wrongAccount(state.viewer.role, "student");
  return state.viewer.id;
}

const insightUpdateSchema = z.discriminatedUnion("action", [
  z.object({ id: z.uuid(), action: z.literal("confirm") }),
  z.object({ id: z.uuid(), action: z.literal("dismiss") }),
  z.object({ id: z.uuid(), action: z.literal("restore") }),
  z.object({
    id: z.uuid(),
    action: z.literal("correct"),
    note: z
      .string()
      .trim()
      .min(3, "Tell your tutor what's actually right (at least a few words).")
      .max(300, "Keep it under 300 characters."),
  }),
]);

export async function updateInsight(input: unknown): Promise<ActionResult> {
  const id = await student();
  if (typeof id !== "string") return id;
  const parsed = insightUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    return failure("invalid", msg, msg ? { note: msg } : undefined);
  }
  const p = parsed.data;
  const values =
    p.action === "confirm"
      ? { status: "confirmed" as const, student_note: null }
      : p.action === "dismiss"
        ? { status: "dismissed" as const }
        : p.action === "restore"
          ? { status: "active" as const, student_note: null }
          : { status: "corrected" as const, student_note: p.note };
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("student_memory")
    .update(values)
    .eq("id", p.id)
    .eq("student_id", id)
    .select("id");
  if (error) return fromDatabaseError(error);
  if (!data?.length) return failure("not_found");
  refresh();
  return success();
}

export async function deleteInsight(input: unknown): Promise<ActionResult> {
  const id = await student();
  if (typeof id !== "string") return id;
  const parsed = z.uuid().safeParse(input);
  if (!parsed.success) return failure("invalid");
  const db = await createSupabaseServerClient();
  const { error } = await db.from("student_memory").delete().eq("id", parsed.data).eq("student_id", id);
  if (error) return fromDatabaseError(error);
  refresh();
  return success();
}

const resetSchema = z.object({
  subjectId: z.uuid(),
  topicKey: z.string().regex(/^[a-z0-9][a-z0-9 ]{0,59}$/),
});

/** Forget one topic: its evidence, mastery, history and the insights about it. */
export async function resetTopic(input: unknown): Promise<ActionResult> {
  const id = await student();
  if (typeof id !== "string") return id;
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return failure("invalid");
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("reset_learning_topic", {
    p_subject: parsed.data.subjectId,
    p_topic_key: parsed.data.topicKey,
  });
  if (error) return fromDatabaseError(error);
  refresh();
  return success();
}

/** Clear everything Lumio has learned about the student. Requires typed confirmation. */
export async function clearLearningMemory(confirmation: unknown): Promise<ActionResult> {
  const id = await student();
  if (typeof id !== "string") return id;
  if (confirmation !== "clear") return failure("invalid");
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("clear_learning_memory");
  if (error) return fromDatabaseError(error);
  refresh();
  return success();
}
