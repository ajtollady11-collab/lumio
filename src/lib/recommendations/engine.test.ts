import { describe, expect, it } from "vitest";
import { buildExams, buildSubjects } from "@/lib/dashboard/model";
import type { DashboardActivity } from "@/lib/dashboard/types";
import { REF, TODAY, activeActivity, emptyActivity, profile } from "@/test/dashboard-fixtures";
import { buildRecommendations, type Recommendation, type RecommendationContext } from "./engine";

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
