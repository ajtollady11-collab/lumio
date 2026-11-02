import { z } from "zod";
import { isAssessed, type MasteryLevel } from "./levels";

/*
 * The learning profile read model (public.get_learning_profile) and the pure
 * functions that turn it into what the student sees. Every figure here comes
 * from a stored row; nothing is estimated.
 */

export const learningProfileSchema = z.object({
  mastery: z.array(
    z.object({
      subjectId: z.string(),
      topicKey: z.string(),
      topic: z.string(),
      level: z.coerce.number(),
      score: z.union([z.coerce.number(), z.null()]),
      evidenceCount: z.coerce.number(),
      correctCount: z.coerce.number(),
      incorrectCount: z.coerce.number(),
      firstSeenAt: z.string(),
      lastEvidenceAt: z.string().nullable(),
      lastSeenAt: z.string(),
      levelChangedAt: z.string().nullable(),
    }),
  ),
  changes: z.array(
    z.object({
      subjectId: z.string(),
      topicKey: z.string(),
      topic: z.string(),
      fromLevel: z.coerce.number(),
      toLevel: z.coerce.number(),
      changedAt: z.string(),
    }),
  ),
  insights: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["topic_studied", "strength", "weakness", "misconception", "note", "learning_pattern"]),
      subjectId: z.string().nullable(),
      topic: z.string(),
      detail: z.string().nullable(),
      source: z.string(),
      occurrences: z.coerce.number(),
      status: z.enum(["active", "confirmed", "corrected", "dismissed"]),
      confidence: z.enum(["low", "medium", "high"]),
      evidenceSummary: z.string().nullable(),
      studentNote: z.string().nullable(),
      firstSeenAt: z.string(),
      lastSeenAt: z.string(),
    }),
  ),
  questionsAnswered: z.coerce.number(),
});
export type LearningProfileRow = z.infer<typeof learningProfileSchema>;
export type MasteryRow = LearningProfileRow["mastery"][number];
export type InsightRow = LearningProfileRow["insights"][number];
export type ChangeRow = LearningProfileRow["changes"][number];

export type SubjectRef = { id: string; slug: string; name: string; accent: string; nextExamDays: number | null };

export type TopicView = MasteryRow & {
  assessed: boolean;
  weak: boolean;
  history: ChangeRow[];
};

/** A weakness insight the student hasn't dismissed. */
const activeInsight = (i: InsightRow) => i.status !== "dismissed";
const sameTopic = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function topicsBySubject(p: LearningProfileRow, subjects: SubjectRef[]) {
  const weakness = p.insights.filter((i) => i.kind === "weakness" && activeInsight(i));
  return subjects.map((s) => {
    const topics: TopicView[] = p.mastery
      .filter((m) => m.subjectId === s.id)
      .map((m) => ({
        ...m,
        assessed: isAssessed(m.level, m.evidenceCount),
        weak: weakness.some((w) => w.subjectId === s.id && sameTopic(w.topic, m.topic)),
        history: p.changes.filter((c) => c.subjectId === s.id && c.topicKey === m.topicKey).reverse(),
      }))
      .sort((a, b) => Number(b.assessed) - Number(a.assessed) || b.lastSeenAt.localeCompare(a.lastSeenAt));
    return {
      subject: s,
      topics,
      counts: {
        tracked: topics.length,
        assessed: topics.filter((t) => t.assessed).length,
        strong: topics.filter((t) => t.level >= 5).length,
        toImprove: topics.filter((t) => t.weak).length,
      },
    };
  });
}

/** Level rises in the last `days` days — one per topic, newest first. */
export function recentImprovements(p: LearningProfileRow, now: Date, days = 60): ChangeRow[] {
  const since = now.getTime() - days * 86_400_000;
  const seen = new Set<string>();
  return p.changes
    .filter((c) => c.toLevel > c.fromLevel && c.toLevel >= 3 && Date.parse(c.changedAt) >= since)
    .filter((c) => {
      const k = `${c.subjectId}:${c.topicKey}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

export function strengths(p: LearningProfileRow) {
  return p.insights.filter((i) => i.kind === "strength" && activeInsight(i));
}

export function areasToImprove(p: LearningProfileRow) {
  return p.insights
    .filter(
      (i) => (i.kind === "weakness" || i.kind === "misconception") && activeInsight(i) && i.status !== "corrected",
    )
    .sort((a, b) => (a.kind === b.kind ? b.lastSeenAt.localeCompare(a.lastSeenAt) : a.kind === "weakness" ? -1 : 1));
}

/** Patterns need at least two observations before they're presented as a pattern. */
export function learningPatterns(p: LearningProfileRow) {
  return p.insights
    .filter((i) => i.kind === "learning_pattern" && activeInsight(i) && i.occurrences >= 2)
    .sort((a, b) => b.occurrences - a.occurrences);
}

/** Everything the student can manage, newest first. "Studied" records are shown per topic instead. */
export function manageableInsights(p: LearningProfileRow) {
  return p.insights.filter((i) => i.kind !== "topic_studied");
}

export type TopicSignal = {
  subjectId: string;
  slug: string;
  subjectName: string;
  accent: string;
  nextExamDays: number | null;
  topic: string;
  topicKey: string;
  level: MasteryLevel;
  evidenceCount: number;
  incorrectCount: number;
  lastEvidenceAt: string | null;
  lastSeenAt: string;
  weak: boolean;
};

/** Mastery rows as signals for the recommendation engine. */
export function topicSignals(p: LearningProfileRow, subjects: SubjectRef[]): TopicSignal[] {
  return topicsBySubject(p, subjects).flatMap(({ subject, topics }) =>
    topics.map((t) => ({
      subjectId: subject.id,
      slug: subject.slug,
      subjectName: subject.name,
      accent: subject.accent,
      nextExamDays: subject.nextExamDays,
      topic: t.topic,
      topicKey: t.topicKey,
      level: Math.min(6, Math.max(1, t.level)) as MasteryLevel,
      evidenceCount: t.evidenceCount,
      incorrectCount: t.incorrectCount,
      lastEvidenceAt: t.lastEvidenceAt,
      lastSeenAt: t.lastSeenAt,
      weak: t.weak,
    })),
  );
}

export const EMPTY_PROFILE: LearningProfileRow = { mastery: [], changes: [], insights: [], questionsAnswered: 0 };
