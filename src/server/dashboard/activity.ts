import "server-only";
import { dashboardActivitySchema, type DashboardActivity } from "@/lib/dashboard/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Every activity-derived figure on the dashboard in ONE round trip
 * (public.get_dashboard_activity, SECURITY INVOKER — RLS limits it to the
 * signed-in student). Not cached across requests: it is per-student and
 * changes whenever they study. Returns null if the database can't be reached
 * or the response doesn't match the expected shape.
 */
export async function getDashboardActivity(): Promise<DashboardActivity | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_dashboard_activity");
  if (error || !data) return null;
  const parsed = dashboardActivitySchema.safeParse(data);
  if (!parsed.success) {
    console.error("get_dashboard_activity: unexpected shape", parsed.error.issues.slice(0, 3));
    return null;
  }
  return parsed.data;
}
