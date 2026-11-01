import { z } from "zod";

/** Limits match student_learning_goals check constraints (migration 0008). */
export const GOAL_FIELDS = [
  {
    key: "weeklyMinutes",
    label: "Study time",
    unit: "minutes a week",
    min: 15,
    max: 3000,
    step: 15,
    hint: "Active learning only — having Lumio open doesn't count.",
  },
  { key: "weeklyLessons", label: "Lessons", unit: "a week", min: 1, max: 50, step: 1, hint: "Completed lessons." },
  {
    key: "weeklySubjects",
    label: "Subjects covered",
    unit: "a week",
    min: 1,
    max: 15,
    step: 1,
    hint: "Different subjects you study properly in a week.",
  },
  {
    key: "weeklyRevisionSessions",
    label: "Revision sessions",
    unit: "a week",
    min: 1,
    max: 50,
    step: 1,
    hint: "Completed quizzes, exam practice, or 5+ minutes of flashcards or revision.",
  },
] as const;

export type GoalKey = (typeof GOAL_FIELDS)[number]["key"];

const goalNumber = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : typeof v === "string" ? Number(v) : v),
    z
      .number({ error: `${label} must be a number.` })
      .int(`${label} must be a whole number.`)
      .min(min, `${label}: at least ${min}.`)
      .max(max, `${label}: at most ${max}.`)
      .nullable(),
  );

export const weeklyGoalsSchema = z
  .object(
    Object.fromEntries(GOAL_FIELDS.map((f) => [f.key, goalNumber(f.min, f.max, f.label)])) as {
      [K in GoalKey]: ReturnType<typeof goalNumber>;
    },
  )
  .refine((g) => Object.values(g).some((v) => v !== null), {
    message: "Set at least one goal, or use “Remove goals”.",
    path: ["weeklyMinutes"],
  });

export type WeeklyGoalsInput = { [K in GoalKey]: number | null };
