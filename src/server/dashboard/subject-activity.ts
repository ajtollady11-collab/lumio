import "server-only";
import { ACTIVITY_TYPES, type RecentActivity } from "@/lib/dashboard/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The student's latest tracked activity in one subject (RLS: own rows only). */
export async function getSubjectActivity(subjectId: string, limit = 10): Promise<RecentActivity[] | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("study_activity_events")
    .select("id, activity_type, subject_id, title, occurred_at, active_seconds, completed, score_percent")
    .eq("subject_id", subjectId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) return null;
  return (data ?? [])
    .filter((r) => (ACTIVITY_TYPES as readonly string[]).includes(r.activity_type))
    .map((r) => ({
      id: r.id,
      type: r.activity_type,
      subjectId: r.subject_id,
      title: r.title,
      occurredAt: r.occurred_at,
      activeSeconds: r.active_seconds,
      completed: r.completed,
      scorePercent: r.score_percent === null ? null : Number(r.score_percent),
    }));
}
