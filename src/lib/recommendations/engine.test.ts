import { describe, expect, it } from "vitest";
import { buildExams, buildSubjects } from "@/lib/dashboard/model";
import type { DashboardActivity } from "@/lib/dashboard/types";
import { topicSignals } from "@/lib/learning/profile";
import { REF, TODAY, activeActivity, emptyActivity, learningProfile, profile } from "@/test/dashboard-fixtures";
import {
  buildRecommendations,
  checkIntroducedRule,
  LEARNING_RULES,
  readyHarderRule,
  revisitTopicRule,
  reviewDueRule,
  type Recommendation,
  type RecommendationContext,
} from "./engine";

function ctx(
  p = profile(),
  activity: DashboardActivity = emptyActivity(),
  consentPending = false,
): RecommendationContext {
  return {
    today: TODAY,
    subjects: buildSubjects(p, REF, activity),
    exams: buildExams(p, REF, TODAY),
    activity,
    consentPending,
  };
}
const kinds = (recs: Recommendation[]) => recs.map((r) => r.kind);

describe("buildRecommendations", () => {
  it("puts a close exam first, with a factual reason and a working subject link", () => {
    const [first] = buildRecommendations(ctx());
    expect(first.kind).toBe("exam_soon");
    expect(first.subject?.name).toBe("Chemistry");
    expect(first.reason).toBe("Your Chemistry (Paper 1) exam is in 8 days. You haven't studied it yet this week.");
    expect(first.action.href).toBe("/app/subjects/chemistry");
    expect(first.minutes).toBe(30);
  });

  it("never gives two recommendations for the same subject", () => {
    // Chemistry is both 'exam soon' and 'finding it hard'.
    const recs = buildRecommendations(ctx());
    const subjects = recs.flatMap((r) => (r.subject ? [r.subject.id] : []));
    expect(new Set(subjects).size).toBe(subjects.length);
    expect(recs.some((r) => r.kind === "finding_hard" && r.subject?.id === "s-chem")).toBe(false);
  });

  it("caps the list and avoids repeating the same kind", () => {
    const p = profile({
      exams: [],
      subjects: ["s-bio", "s-chem", "s-econ", "s-maths"].map((id) => ({
        subjectId: id,
        qualificationId: "q-a",
        examBoardId: "b-aqa",
        currentGrade: null,
        targetGrade: null,
        confidence: null,
      })),
    });
    const activity = emptyActivity({
      totals: { ...emptyActivity().totals, events: 3, lastActiveDate: TODAY },
      goals: { weeklyMinutes: 60, weeklyLessons: null, weeklySubjects: null, weeklyRevisionSessions: null },
    });
    const recs = buildRecommendations(ctx(p, activity));
    expect(recs.length).toBeLessThanOrEqual(4);
    expect(kinds(recs).filter((k) => k === "not_this_week")).toHaveLength(1);
  });

  it("guides a brand-new student towards setup, without inventing study advice", () => {
    const p = profile({ exams: [] });
    const recs = buildRecommendations(ctx(p));
    expect(kinds(recs)).toContain("add_exams");
    expect(kinds(recs)).toContain("add_boards");
    expect(kinds(recs)).not.toContain("not_this_week"); // no history → no "you haven't studied X"
    expect(kinds(recs)).not.toContain("resume");
    expect(recs.find((r) => r.kind === "add_boards")?.title).toBe("Add the exam board for Economics");
  });

  it("uses real quiz averages for weak subjects", () => {
    const recs = buildRecommendations(ctx(profile({ exams: [] }), activeActivity()));
    const low = recs.find((r) => r.kind === "low_scores");
    expect(low?.subject?.name).toBe("Chemistry");
    expect(low?.reason).toBe("Your Chemistry average is 52% across 3 assessed activities.");
  });

  it("encourages a student who has stopped studying to resume", () => {
    const activity = emptyActivity({
      totals: { ...emptyActivity().totals, events: 5, lastActiveDate: "2026-10-28" },
    });
    const recs = buildRecommendations(ctx(profile({ exams: [] }), activity));
    const resume = recs.find((r) => r.kind === "resume");
    expect(resume?.reason).toMatch(/7 days ago/);
    expect(resume?.action.href).toBe("/app/subjects");
  });

  it("asks under-13s to get a parent linked before anything else", () => {
    expect(buildRecommendations(ctx(profile(), emptyActivity(), true))[0].kind).toBe("consent");
  });

  it("only suggests setting goals when none exist", () => {
    expect(kinds(buildRecommendations(ctx(profile({ exams: [] }), emptyActivity())))).toContain("set_goals");
    expect(kinds(buildRecommendations(ctx(profile({ exams: [] }), activeActivity())))).not.toContain("set_goals");
  });

  it("is deterministic", () => {
    expect(buildRecommendations(ctx())).toEqual(buildRecommendations(ctx()));
  });

  it("accepts extra rules (e.g. future tutor-memory insights) without changing callers", () => {
    const extra = () => [
      {
        key: "tutor:osmosis",
        kind: "low_scores" as const,
        priority: 99,
        subject: null,
        title: "Revisit osmosis",
        reason: "Test",
        minutes: 10,
        action: { label: "Go", href: "/app" },
      },
    ];
    const recs = buildRecommendations(ctx(), [extra]);
    expect(recs).toHaveLength(1);
    expect(recs[0].key).toBe("tutor:osmosis");
  });
});

describe("buildRecommendations — topic mastery rules", () => {
  const SUBJECTS = [
    { id: "s-bio", slug: "biology", name: "Biology", accent: "#39d3a1", nextExamDays: 216 },
    { id: "s-chem", slug: "chemistry", name: "Chemistry", accent: "#6b9bff", nextExamDays: 8 },
  ];
  const withTopics = (): RecommendationContext => ({
    ...ctx(profile({ exams: [] })),
    topics: topicSignals(learningProfile(), SUBJECTS),
  });

  it("returns nothing topic-level without mastery data", () => {
    expect(LEARNING_RULES.flatMap((r) => r(ctx()))).toEqual([]);
  });

  it("suggests revisiting a weak topic, with the reason and a tutor link", () => {
    const [rec] = revisitTopicRule(withTopics());
    expect(rec.title).toBe("Revisit Osmosis");
    expect(rec.reason).toBe("3 recent answers on Osmosis weren't right.");
    expect(rec.action.href).toBe("/app/tutor?subject=biology&topic=Osmosis");
  });

  it("offers harder questions only for Strong topics", () => {
    expect(readyHarderRule(withTopics()).map((r) => r.title)).toEqual(["Try harder Cells questions"]);
  });

  it("flags a review after 3 weeks, more urgently when the exam is close", () => {
    const [rec] = reviewDueRule(withTopics());
    expect(rec.title).toBe("Quick review: Bonding");
    expect(rec.reason).toMatch(/30 days ago .* before your exam\.$/);
    const far = { ...withTopics(), topics: withTopics().topics!.map((t) => ({ ...t, nextExamDays: null })) };
    expect(reviewDueRule(far)[0].priority).toBeLessThan(rec.priority);
  });

  it("asks for a check on topics that were introduced but never assessed", () => {
    expect(checkIntroducedRule(withTopics()).map((r) => r.title)).toEqual(["Check your understanding of Enzymes"]);
  });

  it("ranks a weak topic in the default dashboard rules and still keeps one per subject", () => {
    const recs = buildRecommendations(withTopics());
    expect(recs.some((r) => r.kind === "revisit_topic")).toBe(true);
    const ids = recs.flatMap((r) => (r.subject ? [r.subject.id] : []));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("allows more per subject when asked (profile page)", () => {
    const recs = buildRecommendations(withTopics(), LEARNING_RULES, 5, { perSubject: 2, perKind: 2 });
    expect(recs.filter((r) => r.subject?.id === "s-bio").length).toBe(2);
  });
});
