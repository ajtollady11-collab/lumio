import { z } from "zod";
import { daysUntil } from "@/lib/onboarding/dates";
import { DEFAULT_TUTOR, defaultTutorFor, type TutorSettings } from "./options";
import type { CurriculumContext, StudentContext } from "./prompt";
import { quotaSchema } from "./quota";

/*
 * Parses public.get_tutor_context() and turns it, plus curriculum names, into
 * the prompt's StudentContext. Pure — tested without a database.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const tutorContextSchema = z.object({
  today: isoDate,
  quota: quotaSchema,
  profile: z.object({
    firstName: z.string().nullable(),
    ageBand: z.string().nullable(),
    schoolYear: z.number().nullable(),
    educationLevel: z.string().nullable(),
    learningPreferences: z.array(z.string()),
    academicGoals: z.string().nullable(),
    parentalConsent: z.string(),
  }),
  tutor: z
    .object({
      name: z.string(),
      personality: z.enum(["friendly", "patient", "motivational", "professional", "strict_supportive", "encouraging"]),
      teachingStyle: z.enum(["visual", "conversational", "detailed", "simplified", "question_led", "example_based"]),
      pace: z.enum(["slow", "balanced", "fast"]),
      depth: z.enum(["simple", "standard", "detailed"]),
    })
    .nullable(),
  subjects: z.array(
    z.object({
      subjectId: z.string(),
      qualificationId: z.string(),
      examBoardId: z.string().nullable(),
      currentGrade: z.string().nullable(),
      targetGrade: z.string().nullable(),
      confidence: z.enum(["difficult", "neutral", "confident"]).nullable(),
      nextExam: isoDate.nullable(),
      assessedCount: z.coerce.number(),
      averagePercent: z.union([z.coerce.number(), z.null()]),
      lastStudiedDate: isoDate.nullable(),
    }),
  ),
  memory: z.array(
    z.object({
      kind: z.enum(["topic_studied", "strength", "weakness", "misconception", "note"]),
      subjectId: z.string().nullable(),
      topic: z.string(),
      detail: z.string().nullable(),
      occurrences: z.coerce.number(),
    }),
  ),
  conversation: z
    .object({
      id: z.string(),
      title: z.string(),
      subjectId: z.string().nullable(),
      topic: z.string().nullable(),
      messageCount: z.coerce.number(),
    })
    .nullable(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
});
export type TutorContextRow = z.infer<typeof tutorContextSchema>;

export type Names = {
  qualifications: { id: string; name: string }[];
  examBoards: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
};

export function tutorSettingsFrom(row: TutorContextRow): TutorSettings {
  return row.tutor ?? defaultTutorFor(row.profile.learningPreferences) ?? DEFAULT_TUTOR;
}

export function studentContextFrom(row: TutorContextRow, names: Names): StudentContext {
  const nameOf = (list: { id: string; name: string }[], id: string | null) =>
    id ? (list.find((x) => x.id === id)?.name ?? null) : null;
  return {
    today: row.today,
    firstName: row.profile.firstName,
    ageBand: row.profile.ageBand,
    schoolYear: row.profile.schoolYear,
    educationLevel: row.profile.educationLevel,
    learningPreferences: row.profile.learningPreferences,
    academicGoals: row.profile.academicGoals,
    subjects: row.subjects.flatMap((s) => {
      const name = nameOf(names.subjects, s.subjectId);
      if (!name) return [];
      return [
        {
          subjectId: s.subjectId,
          name,
          qualificationName: nameOf(names.qualifications, s.qualificationId) ?? "",
          boardName: nameOf(names.examBoards, s.examBoardId),
          currentGrade: s.currentGrade,
          targetGrade: s.targetGrade,
          confidence: s.confidence,
          nextExam: s.nextExam ? { date: s.nextExam, days: daysUntil(s.nextExam, row.today) } : null,
          assessment:
            s.assessedCount > 0 && s.averagePercent !== null
              ? { averagePercent: s.averagePercent, count: s.assessedCount }
              : null,
          lastStudiedDate: s.lastStudiedDate,
        },
      ];
    }),
    memory: row.memory.map((m) => ({
      kind: m.kind,
      subjectName: nameOf(names.subjects, m.subjectId),
      topic: m.topic,
      detail: m.detail,
      occurrences: m.occurrences,
    })),
  };
}

/** Curriculum context for the chosen subject, using the student's own qualification/board for it. */
export function curriculumFor(
  student: StudentContext,
  subjectId: string | null,
  specification: CurriculumContext["specification"] = null,
): CurriculumContext | null {
  if (!subjectId) return null;
  const s = student.subjects.find((x) => x.subjectId === subjectId);
  if (!s) return null;
  return { subjectName: s.name, qualificationName: s.qualificationName, boardName: s.boardName, specification };
}

/**
 * Anthropic expects alternating turns starting with the user. Stored history
 * can break that (e.g. an interrupted reply), so merge and trim defensively.
 */
export function normaliseTurns(turns: { role: "user" | "assistant"; content: string }[]) {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const t of turns) {
    if (!out.length && t.role === "assistant") continue;
    const last = out.at(-1);
    if (last && last.role === t.role) last.content = `${last.content}\n\n${t.content}`;
    else out.push({ ...t });
  }
  return out;
}

/** Keeps the most recent turns within a character budget (≈ tokens × 4). */
export function trimHistory<T extends { content: string }>(turns: T[], maxChars = 16_000): T[] {
  let total = 0;
  const kept: T[] = [];
  for (let i = turns.length - 1; i >= 0; i--) {
    total += turns[i].content.length;
    if (total > maxChars) break;
    kept.unshift(turns[i]);
  }
  return kept;
}
