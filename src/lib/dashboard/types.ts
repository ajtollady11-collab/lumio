import { z } from "zod";

/*
 * Shape of public.get_dashboard_activity() (migration 0008). Parsed with zod
 * at the boundary so the UI never renders a value the database didn't send.
 */

export const ACTIVITY_TYPES = [
  "lesson",
  "tutor_session",
  "quiz",
  "flashcards",
  "exam_practice",
  "revision",
  "notes",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const num = z.coerce.number();
const numOrNull = z.union([z.coerce.number(), z.null()]);

export const weeklyGoalsShape = z.object({
  weeklyMinutes: z.number().int().nullable(),
  weeklyLessons: z.number().int().nullable(),
  weeklySubjects: z.number().int().nullable(),
  weeklyRevisionSessions: z.number().int().nullable(),
});
export type WeeklyGoals = z.infer<typeof weeklyGoalsShape>;

export const dashboardActivitySchema = z.object({
  timezone: z.string(),
  today: isoDate,
  weekStart: isoDate,
  totals: z.object({
    events: num,
    lessonsCompleted: num,
    activeSeconds: num,
    quizzesCompleted: num,
    quizAveragePercent: numOrNull,
    lastActiveDate: isoDate.nullable(),
    lastActivityAt: z.string().nullable(),
  }),
  week: z.object({ activeSeconds: num, lessons: num, subjects: num, revisionSessions: num }),
  days: z.array(z.object({ date: isoDate, qualified: z.boolean(), activeSeconds: num })),
  streak: z
    .object({ current: num, best: num, lastActiveDate: isoDate.nullable() })
    .nullable()
    .transform((s) => s ?? { current: 0, best: 0, lastActiveDate: null }),
  subjects: z.array(
    z.object({
      subjectId: z.string(),
      lastStudiedDate: isoDate.nullable(),
      studiedThisWeek: z.boolean(),
      sessions: num,
      assessedCount: num,
      averagePercent: numOrNull,
    }),
  ),
  recent: z.array(
    z.object({
      id: z.string(),
      type: z.enum(ACTIVITY_TYPES),
      subjectId: z.string().nullable(),
      title: z.string().nullable(),
      occurredAt: z.string(),
      activeSeconds: num,
      completed: z.boolean(),
      scorePercent: numOrNull,
    }),
  ),
  goals: weeklyGoalsShape.nullable(),
});

export type DashboardActivity = z.infer<typeof dashboardActivitySchema>;
export type SubjectActivity = DashboardActivity["subjects"][number];
export type RecentActivity = DashboardActivity["recent"][number];

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  lesson: "Lesson",
  tutor_session: "Tutor session",
  quiz: "Quiz",
  flashcards: "Flashcards",
  exam_practice: "Exam practice",
  revision: "Revision",
  notes: "Notes",
};
