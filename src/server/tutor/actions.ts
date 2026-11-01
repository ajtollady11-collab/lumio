"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getViewerState } from "@/lib/auth/session";
import { failure, fromDatabaseError, success, wrongAccount, type ActionResult } from "@/lib/errors";
import { renameSchema, tutorSettingsSchema } from "@/lib/tutor/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StoredMessage } from "./data";
import { PAGE_SIZE } from "./data";

/*
 * Tutor settings and conversation management. Every action re-verifies the
 * session and runs as the student, so RLS limits it to their own rows; ids in
 * the input are only ever used together with that check.
 */

async function student(): Promise<string | ActionResult<never>> {
  const state = await getViewerState();
  if (state.status === "unavailable") return failure("unavailable");
  if (state.status === "signed_out") return failure("session_expired");
  if (state.viewer.role !== "student") return wrongAccount(state.viewer.role, "student");
  return state.viewer.id;
}

export async function saveTutorSettings(input: unknown): Promise<ActionResult> {
  const id = await student();
  if (typeof id !== "string") return id;
  const parsed = tutorSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return failure("invalid", parsed.error.issues[0]?.message, fieldErrors);
  }
  const s = parsed.data;
  const values = {
    name: s.name,
    personality: s.personality,
    teaching_style: s.teachingStyle,
    pace: s.pace,
    depth: s.depth,
  };
  const db = await createSupabaseServerClient();
  const updated = await db.from("tutors").update(values).eq("student_id", id).select("student_id");
  if (updated.error) return fromDatabaseError(updated.error);
  if (!updated.data?.length) {
    const inserted = await db.from("tutors").insert({ student_id: id, ...values });
    if (inserted.error) return fromDatabaseError(inserted.error);
  }
  refresh();
  return success();
}

export async function renameConversation(input: unknown): Promise<ActionResult> {
  const id = await student();
  if (typeof id !== "string") return id;
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success)
    return failure("invalid", parsed.error.issues[0]?.message, { title: parsed.error.issues[0]?.message ?? "" });
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("tutor_conversations")
    .update({ title: parsed.data.title })
    .eq("id", parsed.data.conversationId)
    .select("id");
  if (error) return fromDatabaseError(error);
  if (!data?.length) return failure("not_found");
  refresh();
  return success();
}

export async function deleteConversation(conversationId: unknown): Promise<ActionResult> {
  const id = await student();
  if (typeof id !== "string") return id;
  const parsed = z.uuid().safeParse(conversationId);
  if (!parsed.success) return failure("invalid");
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("tutor_conversations").delete().eq("id", parsed.data).select("id");
  if (error) return fromDatabaseError(error);
  if (!data?.length) return failure("not_found");
  refresh();
  return success();
}

export async function loadEarlierMessages(
  conversationId: unknown,
  before: unknown,
): Promise<ActionResult<{ messages: StoredMessage[]; hasEarlier: boolean }>> {
  const id = await student();
  if (typeof id !== "string") return id;
  const parsed = z
    .object({ conversationId: z.uuid(), before: z.iso.datetime({ offset: true }) })
    .safeParse({ conversationId, before });
  if (!parsed.success) return failure("invalid");
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("tutor_messages")
    .select("id, role, content, status, created_at")
    .eq("conversation_id", parsed.data.conversationId)
    .lt("created_at", parsed.data.before)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (error) return fromDatabaseError(error);
  const rows = data ?? [];
  return success({
    hasEarlier: rows.length > PAGE_SIZE,
    messages: rows
      .slice(0, PAGE_SIZE)
      .reverse()
      .map((m) => ({ id: m.id, role: m.role, content: m.content, status: m.status, createdAt: m.created_at })),
  });
}

export async function forgetMemory(memoryId: unknown): Promise<ActionResult> {
  const id = await student();
  if (typeof id !== "string") return id;
  const db = await createSupabaseServerClient();
  const query = db.from("student_memory").delete();
  if (memoryId === "all") {
    const { error } = await query.eq("student_id", id);
    if (error) return fromDatabaseError(error);
  } else {
    const parsed = z.uuid().safeParse(memoryId);
    if (!parsed.success) return failure("invalid");
    const { error } = await query.eq("id", parsed.data);
    if (error) return fromDatabaseError(error);
  }
  refresh();
  return success();
}
