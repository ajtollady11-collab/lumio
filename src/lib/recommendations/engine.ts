import type { DashboardActivity } from "@/lib/dashboard/types";
import {
  EXAM_SOON_DAYS,
  EXAM_UPCOMING_DAYS,
  daysBetween,
  type ExamSummary,
  type SubjectSummary,
} from "@/lib/dashboard/model";

/*
 * Recommendation engine.
 *
 * Deterministic rules over real data — no AI call. Each rule is independent
 * and returns candidate recommendations; the engine ranks them, keeps at most
 * one per subject and one per kind, and caps the list. Later, the tutor's
 * structured memory (weak topics, misconceptions) plugs in as extra rules via
 * `buildRecommendations(ctx, [...DEFAULT_RULES, tutorMemoryRule])` — the
 * dashboard doesn't change.
 */

export type RecommendationKind =
  | "exam_soon"
  | "exam_upcoming"
  | "low_scores"
  | "finding_hard"
  | "resume"
  | "not_this_week"
  | "consent"
  | "add_exams"
  | "add_boards"
  | "set_goals";

export type Recommendation = {
  /** Stable identity, e.g. "exam_soon:biology" — used for de-duplication and React keys. */
  key: string;
  kind: RecommendationKind;
  priority: number;
  subject: { id: string; name: string; slug: string; accent: string } | null;
  /** What to do. */
  title: string;
  /** Why — always a fact from the student's data. */
  reason: string;
  minutes: number | null;
  action: { label: string; href: string };
};

export type RecommendationContext = {
  today: string;
  subjects: SubjectSummary[];
  exams: ExamSummary[];
  activity: Pick<DashboardActivity, "totals" | "goals">;
  consentPending: boolean;
};

export type Rule = (ctx: RecommendationContext) => Recommendation[];

const subjectRef = (s: Pick<SubjectSummary, "subjectId" | "name" | "slug" | "accent">) => ({
  id: s.subjectId,
  name: s.name,
  slug: s.slug,
  accent: s.accent.hex,
});
const subjectHref = (slug: string) => `/app/subjects/${slug}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const listNames = (names: string[]) =>
  names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

export const consentRule: Rule = (ctx) =>
  ctx.consentPending
    ? [
        {
          key: "consent",
          kind: "consent",
          priority: 95,
          subject: null,
          title: "Ask a parent or carer to link their account",
          reason:
            "Because you're under 13, a parent or carer needs to link to your account before tutor lessons start.",
          minutes: null,
          action: { label: "How linking works", href: "/app/settings#family" },
        },
      ]
    : [];

export const examRule: Rule = (ctx) => {
  const seen = new Set<string>();
  return ctx.exams.flatMap((exam) => {
    if (seen.has(exam.subjectId) || exam.days > EXAM_UPCOMING_DAYS) return [];
    seen.add(exam.subjectId);
    const subject = ctx.subjects.find((s) => s.subjectId === exam.subjectId);
    const studied = subject?.studiedThisWeek ?? false;
    const soon = exam.days <= EXAM_SOON_DAYS;
    const when = exam.days === 0 ? "today" : exam.days === 1 ? "tomorrow" : `in ${exam.days} days`;
    return [
      {
        key: `${soon ? "exam_soon" : "exam_upcoming"}:${exam.slug}`,
        kind: soon ? "exam_soon" : "exam_upcoming",
        // Sooner exams first; an exam you haven't touched this week ranks higher.
        priority: soon ? 90 - exam.days + (studied ? 0 : 3) : 45 - exam.days / 10,
        subject: subjectRef({
          subjectId: exam.subjectId,
          name: exam.subjectName,
          slug: exam.slug,
          accent: exam.accent,
        }),
        title: soon ? `Revise ${exam.subjectName} for your exam` : `Start planning ${exam.subjectName} revision`,
        reason: `Your ${exam.subjectName}${exam.notes ? ` (${exam.notes})` : ""} exam is ${when}.${
          soon && !studied ? ` You haven't studied it yet this week.` : ""
        }`,
        minutes: soon ? 30 : 20,
        action: { label: `Open ${exam.subjectName}`, href: subjectHref(exam.slug) },
      },
    ];
  });
};

export const lowScoresRule: Rule = (ctx) =>
  ctx.subjects
    .filter((s) => s.performance && s.performance.assessedCount >= 2 && s.performance.averagePercent < 60)
    .map((s) => ({
      key: `low_scores:${s.slug}`,
      kind: "low_scores" as const,
      priority: 70 + (60 - s.performance!.averagePercent) / 10,
      subject: subjectRef(s),
      title: `Go back over ${s.name}`,
      reason: `Your ${s.name} average is ${Math.round(s.performance!.averagePercent)}% across ${plural(
        s.performance!.assessedCount,
        "assessed activity",
        "assessed activities",
      )}.`,
      minutes: 25,
      action: { label: `Open ${s.name}`, href: subjectHref(s.slug) },
    }));

export const findingHardRule: Rule = (ctx) =>
  ctx.subjects
    .filter(
      (s) =>
        s.confidence === "difficult" &&
        !s.studiedThisWeek &&
        // Once real scores exist they speak for themselves.
        !(s.performance && s.performance.averagePercent >= 70),
    )
    .map((s) => ({
      key: `finding_hard:${s.slug}`,
      kind: "finding_hard" as const,
      priority: 60,
      subject: subjectRef(s),
      title: `Spend 20 minutes on ${s.name}`,
      reason: `You told us ${s.name} feels hard at the moment, and you haven't studied it yet this week.`,
      minutes: 20,
      action: { label: `Open ${s.name}`, href: subjectHref(s.slug) },
    }));

export const resumeRule: Rule = (ctx) => {
  const last = ctx.activity.totals.lastActiveDate;
  if (!last) return [];
  const gap = daysBetween(last, ctx.today);
  if (gap < 3) return [];
  return [
    {
      key: "resume",
      kind: "resume",
      priority: 80,
      subject: null,
      title: "Pick up where you left off",
      reason: `Your last study session was ${gap} days ago. A short session today restarts your streak.`,
      minutes: 15,
      action: { label: "Choose a subject", href: "/app/subjects" },
    },
  ];
};

/** Only meaningful once the student has a history; otherwise it's just noise. */
export const notThisWeekRule: Rule = (ctx) => {
  if (ctx.activity.totals.events === 0) return [];
  return ctx.subjects
    .filter((s) => !s.studiedThisWeek)
    .sort((a, b) => (a.lastStudiedDate ?? "").localeCompare(b.lastStudiedDate ?? ""))
    .map((s, i) => ({
      key: `not_this_week:${s.slug}`,
      kind: "not_this_week" as const,
      priority: 35 - i,
      subject: subjectRef(s),
      title: `Fit in some ${s.name}`,
      reason: s.lastStudiedDate
        ? `You haven't studied ${s.name} this week — last time was ${plural(daysBetween(s.lastStudiedDate, ctx.today), "day")} ago.`
        : `You haven't studied ${s.name} on Lumio yet.`,
      minutes: 20,
      action: { label: `Open ${s.name}`, href: subjectHref(s.slug) },
    }));
};

export const addExamsRule: Rule = (ctx) =>
  ctx.exams.length === 0 && ctx.subjects.length > 0
    ? [
        {
          key: "add_exams",
          kind: "add_exams",
          priority: 25,
          subject: null,
          title: "Add your exam dates",
          reason: "With your dates saved, Lumio can show countdowns and tell you which subject is most urgent.",
          minutes: 2,
          action: { label: "Add exam dates", href: "/app/settings#exams" },
        },
      ]
    : [];

export const addBoardsRule: Rule = (ctx) => {
  const missing = ctx.subjects.filter((s) => !s.boardName);
  if (!missing.length) return [];
  return [
    {
      key: "add_boards",
      kind: "add_boards",
      priority: 20,
      subject: null,
      title: `Add the exam board for ${listNames(missing.map((s) => s.name))}`,
      reason: "Your tutor teaches to your exact specification, so it needs to know which board you're sitting.",
      minutes: 1,
      action: { label: "Choose exam boards", href: "/app/settings#studies" },
    },
  ];
};

export const setGoalsRule: Rule = (ctx) =>
  ctx.activity.goals
    ? []
    : [
        {
          key: "set_goals",
          kind: "set_goals",
          priority: 15,
          subject: null,
          title: "Set a weekly goal",
          reason: "A target for study time or lessons lets you see each week whether you're on track.",
          minutes: 1,
          action: { label: "Set goals", href: "#weekly-goals" },
        },
      ];

export const DEFAULT_RULES: Rule[] = [
  consentRule,
  examRule,
  lowScoresRule,
  findingHardRule,
  resumeRule,
  notThisWeekRule,
  addExamsRule,
  addBoardsRule,
  setGoalsRule,
];

export const MAX_RECOMMENDATIONS = 4;

export function buildRecommendations(
  ctx: RecommendationContext,
  rules: Rule[] = DEFAULT_RULES,
  max = MAX_RECOMMENDATIONS,
): Recommendation[] {
  const ranked = rules
    .flatMap((rule) => rule(ctx))
    .sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key));

  const keys = new Set<string>();
  const subjects = new Set<string>();
  const kindCounts = new Map<RecommendationKind, number>();
  const out: Recommendation[] = [];
  for (const rec of ranked) {
    if (out.length >= max) break;
    if (keys.has(rec.key)) continue;
    // One suggestion per subject: the most important reason wins.
    if (rec.subject && subjects.has(rec.subject.id)) continue;
    // Avoid a wall of the same kind ("Fit in some X" ×4). Exams are the exception.
    const sameKind = kindCounts.get(rec.kind) ?? 0;
    if (sameKind >= (rec.kind === "exam_soon" ? 2 : 1)) continue;
    keys.add(rec.key);
    if (rec.subject) subjects.add(rec.subject.id);
    kindCounts.set(rec.kind, sameKind + 1);
    out.push(rec);
  }
  return out;
}
