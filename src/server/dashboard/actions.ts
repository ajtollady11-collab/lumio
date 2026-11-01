"use server";

import { refresh } from "next/cache";
import { getViewerState } from "@/lib/auth/session";
import { weeklyGoalsSchema } from "@/lib/dashboard/goals";
import { failure, fromDatabaseError, success, wrongAccount, type ActionResult } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Weekly goals. Validated here and again by table constraints; RLS restricts
 * writes to the signed-in student's own row.
 */

async function studentId(): Promise<string | ActionResult> {
  const state = await getViewerState();
  if (state.status === "unavailable") return failure("unavailable");
  if (state.status === "signed_out") return failure("session_expired");
  if (state.viewer.role !== "student") return wrongAccount(state.viewer.role, "student");
  return state.viewer.id;
}

export async function saveWeeklyGoals(input: unknown): Promise<ActionResult> {
  const id = await studentId();
  if (typeof id !== "string") return id;

  const parsed = weeklyGoalsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return failure("invalid", parsed.error.issues[0]?.message, fieldErrors);
  }
  const g = parsed.data;

  const values = {
    weekly_minutes: g.weeklyMinutes,
    weekly_lessons: g.weeklyLessons,
    weekly_subjects: g.weeklySubjects,
    weekly_revision_sessions: g.weeklyRevisionSessions,
  };
  const supabase = await createSupabaseServerClient();
  // Update-then-insert rather than upsert: an upsert would also SET student_id,
  // which students are (deliberately) not granted.
  const updated = await supabase
    .from("student_learning_goals")
    .update(values)
    .eq("student_id", id)
    .select("student_id");
  if (updated.error) return fromDatabaseError(updated.error);
  if (!updated.data?.length) {
    const inserted = await supabase.from("student_learning_goals").insert({ student_id: id, ...values });
    if (inserted.error) return fromDatabaseError(inserted.error);
  }
  refresh();
  return success();
}

export async function clearWeeklyGoals(): Promise<ActionResult> {
  const id = await studentId();
  if (typeof id !== "string") return id;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("student_learning_goals").delete().eq("student_id", id);
  if (error) return fromDatabaseError(error);
  refresh();
  return success();
}
