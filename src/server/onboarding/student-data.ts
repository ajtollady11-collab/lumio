import "server-only";
import type { OnboardingFacts } from "@/lib/onboarding/steps";
import type { AgeBand, Confidence, EducationLevel, LearningPreference } from "@/lib/onboarding/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export type StudentSubjectRow = {
  id: string;
  subjectId: string;
  qualificationId: string;
  examBoardId: string | null;
  currentGrade: string | null;
  targetGrade: string | null;
  confidence: Confidence | null;
};

export type ExamRow = {
  id: string;
  subjectId: string;
  qualificationId: string;
  examBoardId: string | null;
  examDate: string;
  notes: string | null;
};

export type StudentSnapshot = {
  profile: {
    firstName: string | null;
    ageBand: AgeBand | null;
    schoolYear: number | null;
    educationLevel: EducationLevel | null;
    primaryQualificationId: string | null;
    academicGoals: string | null;
    learningPreferences: LearningPreference[];
    onboardingStep: number;
    parentalConsent: Enums<"consent_status">;
  };
  subjects: StudentSubjectRow[];
  exams: ExamRow[];
};

/**
 * Everything onboarding and settings need about one student, in three
 * parallel queries. RLS limits each query to the signed-in student's rows.
 * Returns null when the database can't be reached.
 */
export async function getStudentSnapshot(studentId: string): Promise<StudentSnapshot | null> {
  const supabase = await createSupabaseServerClient();
  const [profile, subjects, exams] = await Promise.all([
    supabase
      .from("student_profiles")
      .select(
        "first_name, age_band, school_year, education_level, primary_qualification_id, academic_goals, learning_preferences, onboarding_step, parental_consent",
      )
      .eq("profile_id", studentId)
      .maybeSingle(),
    supabase
      .from("student_subjects")
      .select("id, subject_id, qualification_id, exam_board_id, current_grade, target_grade, confidence")
      .eq("student_id", studentId)
      .order("created_at"),
    supabase
      .from("examination_dates")
      .select("id, subject_id, qualification_id, exam_board_id, exam_date, notes")
      .eq("student_id", studentId)
      .order("exam_date"),
  ]);

  if (profile.error || subjects.error || exams.error || !profile.data) return null;
  const p = profile.data;

  return {
    profile: {
      firstName: p.first_name,
      ageBand: p.age_band,
      schoolYear: p.school_year,
      educationLevel: p.education_level,
      primaryQualificationId: p.primary_qualification_id,
      academicGoals: p.academic_goals,
      learningPreferences: p.learning_preferences as LearningPreference[],
      onboardingStep: p.onboarding_step,
      parentalConsent: p.parental_consent,
    },
    subjects: (subjects.data ?? []).map((s) => ({
      id: s.id,
      subjectId: s.subject_id,
      qualificationId: s.qualification_id,
      examBoardId: s.exam_board_id,
      currentGrade: s.current_grade,
      targetGrade: s.target_grade,
      confidence: s.confidence,
    })),
    exams: (exams.data ?? []).map((e) => ({
      id: e.id,
      subjectId: e.subject_id,
      qualificationId: e.qualification_id,
      examBoardId: e.exam_board_id,
      examDate: e.exam_date,
      notes: e.notes,
    })),
  };
}

export function factsFrom(snapshot: StudentSnapshot): OnboardingFacts {
  const p = snapshot.profile;
  return {
    aboutComplete: Boolean(p.firstName && p.ageBand && p.schoolYear && p.educationLevel),
    hasQualification: Boolean(p.primaryQualificationId),
    subjectCount: snapshot.subjects.length,
    hasPreferences: p.learningPreferences.length > 0,
    recordedStep: p.onboardingStep,
  };
}
