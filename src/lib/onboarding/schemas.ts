import { z } from "zod";
import { LEARNING_PREFERENCE_VALUES } from "./options";

/*
 * Server-side validation for every onboarding and profile write. The database
 * enforces the same rules again (constraints, triggers, RLS); these schemas
 * exist to give students precise, friendly messages.
 */

const uuid = z.uuid({ error: "Choose an option from the list." });

export const aboutSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Enter your first name.")
    .max(40, "Use 40 characters or fewer.")
    .regex(/^[\p{L}\p{M}' -]+$/u, "Use letters, spaces, hyphens or apostrophes."),
  ageBand: z.enum(["under_13", "13_15", "16_17", "18_plus"], { error: "Choose your age." }),
  schoolYear: z.coerce
    .number({ error: "Choose your school year." })
    .int()
    .min(7, "Choose your school year.")
    .max(14, "Choose your school year."),
  educationLevel: z.enum(["gcse", "a_level", "igcse", "other"], { error: "Choose what you're studying." }),
});
export type AboutInput = z.infer<typeof aboutSchema>;

export const qualificationSchema = z.object({ qualificationId: uuid });

export const subjectsSchema = z.object({
  subjectIds: z
    .array(uuid)
    .min(1, "Choose at least one subject.")
    .max(15, "Choose up to 15 subjects.")
    .refine((ids) => new Set(ids).size === ids.length, "Each subject can only be chosen once."),
});

export const boardsSchema = z.object({
  entries: z
    .array(
      z.object({
        subjectId: uuid,
        qualificationId: uuid,
        examBoardId: uuid.nullable(),
      }),
    )
    .max(15),
});
export type BoardEntry = z.infer<typeof boardsSchema>["entries"][number];

const optionalGrade = z
  .string()
  .trim()
  .max(4)
  .nullable()
  .transform((g) => (g ? g : null));

export const goalsSchema = z.object({
  entries: z
    .array(
      z.object({
        subjectId: uuid,
        currentGrade: optionalGrade,
        targetGrade: optionalGrade,
        confidence: z.enum(["difficult", "neutral", "confident"]).nullable(),
      }),
    )
    .max(15),
  academicGoals: z
    .string()
    .trim()
    .max(600, "Keep your goals to 600 characters or fewer.")
    .transform((v) => (v ? v : null))
    .nullable(),
});
export type GoalsInput = z.infer<typeof goalsSchema>;

/** Exam dates: not in the past, within the next three years. Dates are YYYY-MM-DD (UK local). */
export function examSchema(today: string) {
  const maxDate = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() + 3);
    return d.toISOString().slice(0, 10);
  })();
  return z.object({
    id: uuid.optional(),
    subjectId: z.uuid({ error: "Choose a subject." }),
    examDate: z
      .string({ error: "Choose the exam date." })
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the exam date.")
      // Round-trip check: Date.parse silently rolls 2027-02-30 forward to 2 March.
      .refine((d) => {
        const t = Date.parse(`${d}T00:00:00Z`);
        return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d;
      }, "That date isn't valid.")
      .refine((d) => d >= today, "That date has already passed.")
      .refine((d) => d <= maxDate, "Choose a date within the next three years."),
    notes: z
      .string()
      .trim()
      .max(200, "Keep notes to 200 characters or fewer.")
      .transform((v) => (v ? v : null))
      .nullable(),
  });
}
export type ExamInput = z.infer<ReturnType<typeof examSchema>>;

export const preferencesSchema = z.object({
  preferences: z
    .array(z.enum(LEARNING_PREFERENCE_VALUES))
    .min(1, "Choose at least one way you like to learn.")
    .max(6)
    .refine((v) => new Set(v).size === v.length),
});

export const parentAboutSchema = z.object({
  firstName: aboutSchema.shape.firstName,
  weeklyReportOptIn: z.boolean(),
});

/** Invitation codes: 12 Crockford base32 characters; separators and case don't matter. */
export const inviteCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
  .refine((v) => v.length === 12, "Codes have 12 letters and numbers, like ABCD-EFGH-JKMN.");

/** Today's date in Europe/London as YYYY-MM-DD. */
export function londonToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
