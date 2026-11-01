import { describe, expect, it } from "vitest";
import { REF, TODAY, activeActivity, emptyActivity, profile } from "@/test/dashboard-fixtures";
import { weeklyGoalsSchema } from "./goals";
import {
  buildExams,
  buildGoalProgress,
  buildSubjects,
  formatMinutes,
  greetingSummary,
  localHour,
  partOfDay,
  urgencyFor,
} from "./model";
import { dashboardActivitySchema } from "./types";

describe("buildSubjects", () => {
  it("shows no performance until assessments exist", () => {
    const subjects = buildSubjects(profile(), REF, emptyActivity());
    expect(subjects.map((s) => s.name)).toEqual(["Biology", "Chemistry", "Economics"]);
    expect(subjects.every((s) => s.performance === null)).toBe(true);
    expect(subjects[2].boardName).toBeNull();
  });

  it("uses tracked averages and the next future exam only", () => {
    const [bio, chem] = buildSubjects(profile(), REF, activeActivity());
    expect(chem.performance).toEqual({ averagePercent: 52, assessedCount: 3 });
    expect(bio.performance).toBeNull();
    expect(bio.nextExam?.date).toBe("2027-06-08"); // the October paper has passed
    expect(chem.nextExam?.days).toBe(8);
  });

  it("handles a student with no subjects", () => {
    expect(buildSubjects(profile({ subjects: [] }), REF, emptyActivity())).toEqual([]);
  });
});

describe("buildExams", () => {
  it("sorts chronologically, drops past exams and flags urgency", () => {
    const exams = buildExams(profile(), REF, TODAY);
    expect(exams.map((e) => [e.subjectName, e.days, e.urgency])).toEqual([
      ["Chemistry", 8, "soon"],
      ["Biology", 216, "later"],
    ]);
    expect(exams[0].boardName).toBe("OCR");
  });
  it("urgency thresholds", () => {
    expect([0, 14, 15, 60, 61].map(urgencyFor)).toEqual(["soon", "soon", "upcoming", "upcoming", "later"]);
  });
});

describe("goal progress", () => {
  it("is empty without goals", () => {
    expect(buildGoalProgress(emptyActivity())).toEqual([]);
  });
  it("measures only tracked activity against the goals that are set", () => {
    expect(buildGoalProgress(activeActivity())).toEqual([
      { key: "weeklyMinutes", label: "Study time", unit: "min", target: 240, done: 60 },
      { key: "weeklyLessons", label: "Lessons", unit: "", target: 3, done: 2 },
    ]);
  });
});

describe("weeklyGoalsSchema", () => {
  it("accepts blanks as 'not set' and requires at least one goal", () => {
    expect(
      weeklyGoalsSchema.parse({
        weeklyMinutes: "120",
        weeklyLessons: "",
        weeklySubjects: null,
        weeklyRevisionSessions: undefined,
      }),
    ).toEqual({ weeklyMinutes: 120, weeklyLessons: null, weeklySubjects: null, weeklyRevisionSessions: null });
    expect(
      weeklyGoalsSchema.safeParse({
        weeklyMinutes: "",
        weeklyLessons: "",
        weeklySubjects: "",
        weeklyRevisionSessions: "",
      }).success,
    ).toBe(false);
  });
  it("matches the database limits", () => {
    expect(
      weeklyGoalsSchema.safeParse({
        weeklyMinutes: 10,
        weeklyLessons: null,
        weeklySubjects: null,
        weeklyRevisionSessions: null,
      }).success,
    ).toBe(false);
    expect(
      weeklyGoalsSchema.safeParse({
        weeklyMinutes: null,
        weeklyLessons: 51,
        weeklySubjects: null,
        weeklyRevisionSessions: null,
      }).success,
    ).toBe(false);
    expect(
      weeklyGoalsSchema.safeParse({
        weeklyMinutes: null,
        weeklyLessons: 2.5,
        weeklySubjects: null,
        weeklyRevisionSessions: null,
      }).success,
    ).toBe(false);
  });
});

describe("greeting", () => {
  it("uses the student's timezone for the time of day", () => {
    const now = new Date("2026-11-04T23:30:00Z");
    expect(partOfDay(localHour(now, "Europe/London"))).toBe("evening");
    expect(partOfDay(localHour(now, "Asia/Tokyo"))).toBe("morning"); // 08:30 next day
    expect(partOfDay(localHour(new Date("2026-11-04T13:00:00Z"), "Europe/London"))).toBe("afternoon");
  });

  it("states only facts from the data", () => {
    const p = profile();
    const subjects = buildSubjects(p, REF, emptyActivity());
    // Exam within two weeks wins.
    expect(greetingSummary({ subjects, exams: buildExams(p, REF, TODAY), activity: emptyActivity() })).toBe(
      "Your Chemistry exam is in 8 days.",
    );
    // No exams soon, no activity → just what they've set up.
    const later = buildExams(profile({ exams: p.exams.slice(1) }), REF, TODAY);
    expect(greetingSummary({ subjects, exams: later, activity: emptyActivity() })).toBe(
      "You're studying 3 subjects, with 1 exam on your calendar.",
    );
    // Streak.
    expect(greetingSummary({ subjects, exams: later, activity: activeActivity() })).toBe(
      "You're on a 2-day study streak.",
    );
    // Lapsed.
    const lapsed = emptyActivity({ totals: { ...emptyActivity().totals, events: 2, lastActiveDate: "2026-10-30" } });
    expect(greetingSummary({ subjects, exams: later, activity: lapsed })).toMatch(/^It's been 5 days/);
    // Nothing to say.
    expect(greetingSummary({ subjects: [], exams: [], activity: emptyActivity() })).toBeNull();
  });

  it("formats minutes", () => {
    expect([0, 45, 60, 135].map(formatMinutes)).toEqual(["0 min", "45 min", "1 h", "2 h 15 min"]);
  });
});

describe("dashboardActivitySchema", () => {
  it("parses the database's JSON, including numeric strings and a missing streak row", () => {
    const raw = {
      ...emptyActivity(),
      totals: { ...emptyActivity().totals, quizAveragePercent: "70.0" },
      streak: null,
    };
    const parsed = dashboardActivitySchema.parse(raw);
    expect(parsed.totals.quizAveragePercent).toBe(70);
    expect(parsed.streak).toEqual({ current: 0, best: 0, lastActiveDate: null });
  });
  it("rejects an unexpected activity type rather than rendering it", () => {
    const raw = { ...activeActivity(), recent: [{ ...activeActivity().recent[0], type: "browsing" }] };
    expect(dashboardActivitySchema.safeParse(raw).success).toBe(false);
  });
});
