/**
 * Onboarding step model. Pure functions — shared by the server (to decide
 * where a student may be) and the client (to render progress).
 *
 * Subjects come before exam boards because each subject can have its own
 * board (e.g. Biology with AQA, Economics with Pearson Edexcel).
 */
export const STUDENT_STEPS = [
  { id: 1, key: "about", title: "About you", optional: false },
  { id: 2, key: "qualification", title: "Qualification", optional: false },
  { id: 3, key: "subjects", title: "Subjects", optional: false },
  { id: 4, key: "boards", title: "Exam boards", optional: true },
  { id: 5, key: "goals", title: "Goals", optional: true },
  { id: 6, key: "exams", title: "Exam dates", optional: true },
  { id: 7, key: "preferences", title: "How you learn", optional: false },
  { id: 8, key: "complete", title: "All set", optional: false },
] as const;

export type StudentStepId = (typeof STUDENT_STEPS)[number]["id"];
export const LAST_STEP: StudentStepId = 8;

/** The minimum facts the steps depend on. */
export type OnboardingFacts = {
  aboutComplete: boolean;
  hasQualification: boolean;
  subjectCount: number;
  hasPreferences: boolean;
  /** onboarding_step recorded in the database (last step reached). */
  recordedStep: number;
};

/**
 * The furthest step a student may open. Required steps gate everything after
 * them, so changing the URL or client state can't skip ahead; optional steps
 * (boards, goals, exams) never block.
 */
export function furthestAllowedStep(f: OnboardingFacts): StudentStepId {
  if (!f.aboutComplete) return 1;
  if (!f.hasQualification) return 2;
  if (f.subjectCount === 0) return 3;
  // Steps 4–6 are optional, so "How you learn" is reachable once subjects exist.
  if (!f.hasPreferences) return 7;
  return LAST_STEP;
}

/** Where to resume: the recorded step, but never beyond what's allowed. */
export function resumeStep(f: OnboardingFacts, requested?: number | null): StudentStepId {
  const allowed = furthestAllowedStep(f);
  const wanted = requested && Number.isInteger(requested) ? requested : f.recordedStep;
  return Math.min(Math.max(wanted, 1), allowed) as StudentStepId;
}

export function isComplete(f: OnboardingFacts): boolean {
  return f.aboutComplete && f.hasQualification && f.subjectCount > 0 && f.hasPreferences;
}
