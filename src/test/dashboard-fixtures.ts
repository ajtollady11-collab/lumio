/*
 * TEST FIXTURES ONLY. Never imported by application code.
 * Fictional students for unit tests and visual checks — kept out of
 * src/lib and src/server so they can't leak into the product.
 */
import type { ProfileLite, ReferenceLite } from "@/lib/dashboard/model";
import type { DashboardActivity } from "@/lib/dashboard/types";
import type { LearningProfileRow } from "@/lib/learning/profile";

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

/* ── Learning profile (Phase 5) ─────────────────────────────────────────── */

type Mastery = LearningProfileRow["mastery"][number];
type Insight = LearningProfileRow["insights"][number];

export function masteryRow(o: Partial<Mastery> & Pick<Mastery, "subjectId" | "topic">): Mastery {
  return {
    topicKey: o.topic.toLowerCase(),
    level: 2,
    score: null,
    evidenceCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    firstSeenAt: "2026-10-20T10:00:00Z",
    lastEvidenceAt: null,
    lastSeenAt: "2026-11-03T10:00:00Z",
    levelChangedAt: null,
    ...o,
  };
}

export function insightRow(o: Partial<Insight> & Pick<Insight, "id" | "kind" | "topic">): Insight {
  return {
    subjectId: "s-bio",
    detail: null,
    source: "tutor_conversation",
    occurrences: 1,
    status: "active",
    confidence: "medium",
    evidenceSummary: null,
    studentNote: null,
    firstSeenAt: "2026-10-28T10:00:00Z",
    lastSeenAt: "2026-11-03T10:00:00Z",
    ...o,
  };
}

/**
 * Biology: Osmosis weak (Developing, 1/4 right), Cells strong, Enzymes only
 * introduced (no answers). Chemistry: Bonding Good but last practised 30 days ago.
 */
export function learningProfile(): LearningProfileRow {
  return {
    questionsAnswered: 15,
    mastery: [
      masteryRow({
        subjectId: "s-bio",
        topic: "Osmosis",
        level: 3,
        score: 0.25,
        evidenceCount: 4,
        correctCount: 1,
        incorrectCount: 3,
        lastEvidenceAt: "2026-11-03T10:00:00Z",
      }),
      masteryRow({
        subjectId: "s-bio",
        topic: "Cells",
        level: 5,
        score: 0.86,
        evidenceCount: 6,
        correctCount: 5,
        incorrectCount: 1,
        lastEvidenceAt: "2026-11-02T10:00:00Z",
      }),
      masteryRow({ subjectId: "s-bio", topic: "Enzymes", level: 2 }),
      masteryRow({
        subjectId: "s-chem",
        topic: "Bonding",
        level: 4,
        score: 0.7,
        evidenceCount: 5,
        correctCount: 3,
        incorrectCount: 1,
        lastEvidenceAt: "2026-10-05T10:00:00Z",
        lastSeenAt: "2026-10-05T10:00:00Z",
      }),
    ],
    changes: [
      {
        subjectId: "s-bio",
        topicKey: "cells",
        topic: "Cells",
        fromLevel: 4,
        toLevel: 5,
        changedAt: "2026-11-02T10:00:00Z",
      },
      {
        subjectId: "s-bio",
        topicKey: "cells",
        topic: "Cells",
        fromLevel: 3,
        toLevel: 4,
        changedAt: "2026-10-30T10:00:00Z",
      },
      {
        subjectId: "s-bio",
        topicKey: "osmosis",
        topic: "Osmosis",
        fromLevel: 2,
        toLevel: 3,
        changedAt: "2026-11-01T10:00:00Z",
      },
    ],
    insights: [
      insightRow({
        id: "00000000-0000-4000-8000-000000000001",
        kind: "weakness",
        topic: "Osmosis",
        evidenceSummary: "1 correct, 3 incorrect — since 28 Oct",
        occurrences: 3,
      }),
      insightRow({
        id: "00000000-0000-4000-8000-000000000002",
        kind: "misconception",
        topic: "Osmosis",
        detail: "Thinks solute moves rather than water",
        confidence: "low",
      }),
      insightRow({
        id: "00000000-0000-4000-8000-000000000003",
        kind: "strength",
        topic: "Cells",
        evidenceSummary: "5 correct, 1 incorrect — since 20 Oct",
      }),
      insightRow({
        id: "00000000-0000-4000-8000-000000000004",
        kind: "learning_pattern",
        subjectId: null,
        topic: "Worked examples",
        occurrences: 3,
        evidenceSummary: "Helped 3 times, most recently with Cells",
      }),
      insightRow({
        id: "00000000-0000-4000-8000-000000000005",
        kind: "learning_pattern",
        subjectId: null,
        topic: "Analogies",
        occurrences: 1,
      }),
      insightRow({ id: "00000000-0000-4000-8000-000000000006", kind: "topic_studied", topic: "Enzymes" }),
      insightRow({
        id: "00000000-0000-4000-8000-000000000007",
        kind: "weakness",
        subjectId: "s-chem",
        topic: "Moles",
        status: "dismissed",
      }),
    ],
  };
}
