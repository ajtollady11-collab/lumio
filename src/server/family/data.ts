import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EducationLevel } from "@/lib/onboarding/options";

export type LinkedChild = {
  linkId: string;
  studentId: string;
  name: string;
  linkedAt: string | null;
  /** False when the student has turned off activity sharing: only their name is visible. */
  sharing: boolean;
  educationLevel: EducationLevel | null;
  schoolYear: number | null;
  subjects: { subjectId: string; qualificationId: string; examBoardId: string | null }[];
  upcomingExams: number;
};

export type PendingInvitation = { id: string; createdAt: string; expiresAt: string };

export type ParentHome = {
  firstName: string | null;
  weeklyReportOptIn: boolean;
  children: LinkedChild[];
  invitations: PendingInvitation[];
};

/**
 * Everything the parent home needs. RLS decides what is visible: only actively
 * linked children, and only within the scopes each child has chosen to share.
 */
export async function getParentHome(parentId: string, today: string): Promise<ParentHome | null> {
  const supabase = await createSupabaseServerClient();
  const [parent, links, invitations] = await Promise.all([
    supabase
      .from("parent_profiles")
      .select("first_name, weekly_report_opt_in")
      .eq("profile_id", parentId)
      .maybeSingle(),
    supabase
      .from("parent_student_links")
      .select("id, student_id, accepted_at")
      .eq("parent_id", parentId)
      .eq("status", "active")
      .order("accepted_at"),
    supabase
      .from("parent_invitations")
      .select("id, created_at, expires_at")
      .eq("parent_id", parentId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);
  if (parent.error || links.error || invitations.error || !parent.data) return null;

  const ids = (links.data ?? []).map((l) => l.student_id);
  let children: LinkedChild[] = [];
  if (ids.length) {
    const [profiles, students, subjects, exams] = await Promise.all([
      supabase.from("profiles").select("id, display_name").in("id", ids),
      supabase
        .from("student_profiles")
        .select("profile_id, first_name, education_level, school_year")
        .in("profile_id", ids),
      supabase
        .from("student_subjects")
        .select("student_id, subject_id, qualification_id, exam_board_id")
        .in("student_id", ids)
        .order("created_at"),
      supabase.from("examination_dates").select("student_id").in("student_id", ids).gte("exam_date", today),
    ]);
    if (profiles.error || students.error || subjects.error || exams.error) return null;

    children = (links.data ?? []).map((link) => {
      const student = students.data?.find((s) => s.profile_id === link.student_id);
      const profile = profiles.data?.find((p) => p.id === link.student_id);
      return {
        linkId: link.id,
        studentId: link.student_id,
        name: student?.first_name ?? profile?.display_name ?? "Your child",
        linkedAt: link.accepted_at,
        sharing: Boolean(student),
        educationLevel: student?.education_level ?? null,
        schoolYear: student?.school_year ?? null,
        subjects: (subjects.data ?? [])
          .filter((s) => s.student_id === link.student_id)
          .map((s) => ({ subjectId: s.subject_id, qualificationId: s.qualification_id, examBoardId: s.exam_board_id })),
        upcomingExams: (exams.data ?? []).filter((e) => e.student_id === link.student_id).length,
      };
    });
  }

  return {
    firstName: parent.data.first_name,
    weeklyReportOptIn: parent.data.weekly_report_opt_in,
    children,
    invitations: (invitations.data ?? []).map((i) => ({ id: i.id, createdAt: i.created_at, expiresAt: i.expires_at })),
  };
}

export type LinkedParent = {
  linkId: string;
  name: string;
  linkedAt: string | null;
  shareActivity: boolean;
  shareResults: boolean;
  shareConversations: boolean;
};

/** The parents linked to a student, with the sharing choices the student controls. */
export async function getStudentFamily(studentId: string): Promise<LinkedParent[] | null> {
  const supabase = await createSupabaseServerClient();
  const links = await supabase
    .from("parent_student_links")
    .select("id, parent_id, accepted_at, share_activity, share_results, share_conversations")
    .eq("student_id", studentId)
    .eq("status", "active")
    .order("accepted_at");
  if (links.error) return null;
  const ids = (links.data ?? []).map((l) => l.parent_id);
  if (!ids.length) return [];

  const names = await supabase.from("profiles").select("id, display_name").in("id", ids);
  if (names.error) return null;

  return (links.data ?? []).map((l) => ({
    linkId: l.id,
    name: names.data?.find((n) => n.id === l.parent_id)?.display_name ?? "Your parent",
    linkedAt: l.accepted_at,
    shareActivity: l.share_activity,
    shareResults: l.share_results,
    shareConversations: l.share_conversations,
  }));
}
