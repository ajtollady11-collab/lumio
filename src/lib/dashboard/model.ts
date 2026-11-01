import { daysUntil } from "@/lib/onboarding/dates";
import { subjectAccent, type SubjectAccent } from "@/lib/subjects/appearance";
import type { Confidence } from "@/lib/onboarding/options";
import type { DashboardActivity, SubjectActivity } from "./types";

/*
 * Turns the student's saved profile + tracked activity into what the
 * dashboard shows. Pure and deterministic: same inputs, same output, so every
 * figure can be traced to a database row (and unit-tested).
 */

export type ReferenceLite = {
  qualifications: { id: string; name: string; level: string }[];
  examBoards: { id: string; name: string }[];
  subjects: { id: string; slug: string; name: string }[];
};

export type ProfileLite = {
  firstName: string | null;
  parentalConsent: string;
  subjects: {
    subjectId: string;
    qualificationId: string;
    examBoardId: string | null;
    currentGrade: string | null;
    targetGrade: string | null;
    confidence: Confidence | null;
  }[];
  exams: {
    id: string;
    subjectId: string;
    qualificationId: string;
    examBoardId: string | null;
    examDate: string;
    notes: string | null;
  }[];
};

export type SubjectSummary = {
  subjectId: string;
  slug: string;
  name: string;
  qualificationName: string;
  qualificationLevel: string;
  boardName: string | null;
  currentGrade: string | null;
  targetGrade: string | null;
  confidence: Confidence | null;
  accent: SubjectAccent;
  nextExam: { id: string; date: string; days: number } | null;
  /** Only when completed, scored quizzes / exam practice exist for this subject. */
  performance: { averagePercent: number; assessedCount: number } | null;
  lastStudiedDate: string | null;
  studiedThisWeek: boolean;
  sessions: number;
};

export type ExamSummary = {
  id: string;
  subjectId: string;
  slug: string;
  subjectName: string;
  qualificationName: string;
  boardName: string | null;
  date: string;
  days: number;
  notes: string | null;
  urgency: "soon" | "upcoming" | "later";
  accent: SubjectAccent;
};

export const EXAM_SOON_DAYS = 14;
export const EXAM_UPCOMING_DAYS = 60;

export function urgencyFor(days: number): ExamSummary["urgency"] {
  if (days <= EXAM_SOON_DAYS) return "soon";
  if (days <= EXAM_UPCOMING_DAYS) return "upcoming";
  return "later";
}

export function buildSubjects(
  profile: ProfileLite,
  reference: ReferenceLite,
  activity: Pick<DashboardActivity, "subjects" | "today">,
): SubjectSummary[] {
  const bySubject = new Map<string, SubjectActivity>(activity.subjects.map((s) => [s.subjectId, s]));
  return profile.subjects.flatMap((row) => {
    const subject = reference.subjects.find((s) => s.id === row.subjectId);
    if (!subject) return [];
    const qual = reference.qualifications.find((q) => q.id === row.qualificationId);
    const tracked = bySubject.get(row.subjectId);
    const next = profile.exams
      .filter((e) => e.subjectId === row.subjectId && e.examDate >= activity.today)
      .sort((a, b) => a.examDate.localeCompare(b.examDate))[0];
    return [
      {
        subjectId: row.subjectId,
        slug: subject.slug,
        name: subject.name,
        qualificationName: qual?.name ?? "",
        qualificationLevel: qual?.level ?? "",
        boardName: reference.examBoards.find((b) => b.id === row.examBoardId)?.name ?? null,
        currentGrade: row.currentGrade,
        targetGrade: row.targetGrade,
        confidence: row.confidence,
        accent: subjectAccent(subject.slug),
        nextExam: next ? { id: next.id, date: next.examDate, days: daysUntil(next.examDate, activity.today) } : null,
        performance:
          tracked && tracked.assessedCount > 0 && tracked.averagePercent !== null
            ? { averagePercent: tracked.averagePercent, assessedCount: tracked.assessedCount }
            : null,
        lastStudiedDate: tracked?.lastStudiedDate ?? null,
        studiedThisWeek: tracked?.studiedThisWeek ?? false,
        sessions: tracked?.sessions ?? 0,
      },
    ];
  });
}

export function buildExams(profile: ProfileLite, reference: ReferenceLite, today: string): ExamSummary[] {
  return profile.exams
    .filter((e) => e.examDate >= today)
    .sort((a, b) => a.examDate.localeCompare(b.examDate) || a.id.localeCompare(b.id))
    .flatMap((e) => {
      const subject = reference.subjects.find((s) => s.id === e.subjectId);
      if (!subject) return [];
      const days = daysUntil(e.examDate, today);
      return [
        {
          id: e.id,
          subjectId: e.subjectId,
          slug: subject.slug,
          subjectName: subject.name,
          qualificationName: reference.qualifications.find((q) => q.id === e.qualificationId)?.name ?? "",
          boardName: reference.examBoards.find((b) => b.id === e.examBoardId)?.name ?? null,
          date: e.examDate,
          days,
          notes: e.notes,
          urgency: urgencyFor(days),
          accent: subjectAccent(subject.slug),
        },
      ];
    });
}

/** Whole days between two YYYY-MM-DD dates (b − a). */
export function daysBetween(a: string, b: string): number {
  return daysUntil(b, a);
}

export type GoalProgress = { key: string; label: string; unit: string; target: number; done: number };

export function buildGoalProgress(activity: Pick<DashboardActivity, "goals" | "week">): GoalProgress[] {
  const g = activity.goals;
  if (!g) return [];
  const rows: GoalProgress[] = [];
  if (g.weeklyMinutes !== null)
    rows.push({
      key: "weeklyMinutes",
      label: "Study time",
      unit: "min",
      target: g.weeklyMinutes,
      done: Math.floor(activity.week.activeSeconds / 60),
    });
  if (g.weeklyLessons !== null)
    rows.push({
      key: "weeklyLessons",
      label: "Lessons",
      unit: "",
      target: g.weeklyLessons,
      done: activity.week.lessons,
    });
  if (g.weeklySubjects !== null)
    rows.push({
      key: "weeklySubjects",
      label: "Subjects covered",
      unit: "",
      target: g.weeklySubjects,
      done: activity.week.subjects,
    });
  if (g.weeklyRevisionSessions !== null)
    rows.push({
      key: "weeklyRevisionSessions",
      label: "Revision sessions",
      unit: "",
      target: g.weeklyRevisionSessions,
      done: activity.week.revisionSessions,
    });
  return rows;
}

/** Hour of day (0–23) in the student's timezone. */
export function localHour(now: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(now);
  return Number(h) % 24;
}

export function partOfDay(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/**
 * One factual sentence for the greeting. Each branch states something the
 * data shows; nothing is estimated.
 */
export function greetingSummary(input: {
  subjects: SubjectSummary[];
  exams: ExamSummary[];
  activity: Pick<DashboardActivity, "totals" | "streak" | "today" | "week">;
}): string | null {
  const { subjects, exams, activity } = input;
  const soonest = exams[0];
  if (soonest && soonest.days <= EXAM_SOON_DAYS) {
    if (soonest.days === 0) return `Your ${soonest.subjectName} exam is today. Good luck.`;
    return `Your ${soonest.subjectName} exam is in ${soonest.days} ${soonest.days === 1 ? "day" : "days"}.`;
  }
  const last = activity.totals.lastActiveDate;
  if (last) {
    const gap = daysBetween(last, activity.today);
    if (gap >= 3) return `It's been ${gap} days since your last study session — today's a good day to pick it back up.`;
    if (activity.streak.current >= 2) return `You're on a ${activity.streak.current}-day study streak.`;
    const mins = Math.floor(activity.week.activeSeconds / 60);
    if (mins > 0)
      return `This week: ${formatMinutes(mins)} of active study across ${activity.week.subjects} ${activity.week.subjects === 1 ? "subject" : "subjects"}.`;
  }
  if (subjects.length === 0) return null;
  const examCount = exams.length;
  const s = `You're studying ${subjects.length} ${subjects.length === 1 ? "subject" : "subjects"}`;
  return examCount ? `${s}, with ${examCount} ${examCount === 1 ? "exam" : "exams"} on your calendar.` : `${s}.`;
}

export function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
