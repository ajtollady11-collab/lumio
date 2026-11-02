import "server-only";
import { learningProfileSchema, type LearningProfileRow } from "@/lib/learning/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { defaultTutorFor, type TeachingStyle } from "@/lib/tutor/options";

/**
 * The signed-in student's learning profile in ONE round trip
 * (public.get_learning_profile — SECURITY INVOKER, so RLS limits it to their
 * own rows; parents have no policy on these tables at all). Returns null if
 * the database can't be reached or the shape is unexpected.
 */
export async function getLearningProfile(): Promise<LearningProfileRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_learning_profile");
  if (error || !data) return null;
  const parsed = learningProfileSchema.safeParse(data);
  if (!parsed.success) {
    console.error("get_learning_profile: unexpected shape", parsed.error.issues.slice(0, 3));
    return null;
  }
  return parsed.data;
}

/** Tutor name + style for the profile page (falls back to the onboarding-derived default). */
export async function getTutorBrief(
  learningPreferences: string[],
): Promise<{ name: string; teachingStyle: TeachingStyle } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("tutors").select("name, teaching_style").maybeSingle();
  if (error) return null;
  if (data) return { name: data.name, teachingStyle: data.teaching_style as TeachingStyle };
  const d = defaultTutorFor(learningPreferences);
  return { name: d.name, teachingStyle: d.teachingStyle };
}
