/*
 * TEST FIXTURES ONLY. Never imported by application code.
 * Fictional students for unit tests and visual checks — kept out of
 * src/lib and src/server so they can't leak into the product.
 */
import type { ProfileLite, ReferenceLite } from "@/lib/dashboard/model";
import type { DashboardActivity } from "@/lib/dashboard/types";

export const TODAY = "2026-11-04"; // a Wednesday
export const WEEK_START = "2026-11-02";

export const REF: ReferenceLite = {
  qualifications: [
    { id: "q-gcse", name: "GCSE", level: "gcse" },
    { id: "q-a", name: "A-level", level: "a_level" },
  ],
  examBoards: [
    { id: "b-aqa", name: "AQA" },
    { id: "b-edexcel", name: "Pearson Edexcel" },
    { id: "b-ocr", name: "OCR" },
  ],
  subjects: [
    { id: "s-bio", slug: "biology", name: "Biology" },
    { id: "s-chem", slug: "chemistry", name: "Chemistry" },
    { id: "s-econ", slug: "economics", name: "Economics" },
    { id: "s-maths", slug: "mathematics", name: "Mathematics" },
  ],
};

export function emptyActivity(overrides: Partial<DashboardActivity> = {}): DashboardActivity {
  return {
    timezone: "Europe/London",
    today: TODAY,
    weekStart: WEEK_START,
    totals: {
      events: 0,
      lessonsCompleted: 0,
      activeSeconds: 0,
      quizzesCompleted: 0,
      quizAveragePercent: null,
      lastActiveDate: null,
      lastActivityAt: null,
    },
    week: { activeSeconds: 0, lessons: 0, subjects: 0, revisionSessions: 0 },
    days: Array.from({ length: 7 }, (_, i) => ({
      date: `2026-11-0${2 + i}`,
      qualified: false,
      activeSeconds: 0,
    })),
    streak: { current: 0, best: 0, lastActiveDate: null },
    subjects: [],
    recent: [],
    goals: null,
    ...overrides,
  };
}

/** A student who has studied: Biology yesterday and today, Chemistry quizzes going badly. */
export function activeActivity(): DashboardActivity {
  return emptyActivity({
    totals: {
      events: 9,
      lessonsCompleted: 4,
      activeSeconds: 4 * 1500 + 3 * 600,
      quizzesCompleted: 3,
      quizAveragePercent: 52,
      lastActiveDate: TODAY,
      lastActivityAt: "2026-11-04T16:30:00Z",
    },
    week: { activeSeconds: 2 * 1500 + 600, lessons: 2, subjects: 2, revisionSessions: 1 },
    days: emptyActivity().days.map((d) =>
      d.date === "2026-11-03" || d.date === TODAY ? { ...d, qualified: true, activeSeconds: 1800 } : d,
    ),
    streak: { current: 2, best: 5, lastActiveDate: TODAY },
    subjects: [
      {
        subjectId: "s-bio",
        lastStudiedDate: TODAY,
        studiedThisWeek: true,
        sessions: 4,
        assessedCount: 0,
        averagePercent: null,
      },
      {
        subjectId: "s-chem",
        lastStudiedDate: "2026-11-03",
        studiedThisWeek: true,
        sessions: 3,
        assessedCount: 3,
        averagePercent: 52,
      },
      {
        subjectId: "s-econ",
        lastStudiedDate: "2026-10-20",
        studiedThisWeek: false,
        sessions: 1,
        assessedCount: 0,
        averagePercent: null,
      },
    ],
    recent: [
      {
        id: "e1",
        type: "lesson",
        subjectId: "s-bio",
        title: "Cell structure",
        occurredAt: "2026-11-04T16:30:00Z",
        activeSeconds: 1500,
        completed: true,
        scorePercent: null,
      },
      {
        id: "e2",
        type: "quiz",
        subjectId: "s-chem",
        title: "Bonding",
        occurredAt: "2026-11-03T18:10:00Z",
        activeSeconds: 600,
        completed: true,
        scorePercent: 45,
      },
    ],
    goals: { weeklyMinutes: 240, weeklyLessons: 3, weeklySubjects: null, weeklyRevisionSessions: null },
  });
}

export function profile(overrides: Partial<ProfileLite> = {}): ProfileLite {
  return {
    firstName: "Alex",
    parentalConsent: "not_required",
    subjects: [
      {
        subjectId: "s-bio",
        qualificationId: "q-a",
        examBoardId: "b-aqa",
        currentGrade: "B",
        targetGrade: "A*",
        confidence: "neutral",
      },
      {
        subjectId: "s-chem",
        qualificationId: "q-a",
        examBoardId: "b-ocr",
        currentGrade: null,
        targetGrade: "A",
        confidence: "difficult",
      },
      {
        subjectId: "s-econ",
        qualificationId: "q-a",
        examBoardId: null,
        currentGrade: null,
        targetGrade: null,
        confidence: null,
      },
    ],
    exams: [
      {
        id: "x2",
        subjectId: "s-chem",
        qualificationId: "q-a",
        examBoardId: "b-ocr",
        examDate: "2026-11-12",
        notes: "Paper 1",
      },
      {
        id: "x1",
        subjectId: "s-bio",
        qualificationId: "q-a",
        examBoardId: "b-aqa",
        examDate: "2027-06-08",
        notes: null,
      },
      {
        id: "x0",
        subjectId: "s-bio",
        qualificationId: "q-a",
        examBoardId: "b-aqa",
        examDate: "2026-10-01",
        notes: "past",
      },
    ],
    ...overrides,
  };
}
