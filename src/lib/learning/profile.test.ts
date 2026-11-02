import { describe, expect, it } from "vitest";
import { learningProfile } from "@/test/dashboard-fixtures";
import {
  areasToImprove,
  learningPatterns,
  manageableInsights,
  recentImprovements,
  strengths,
  topicSignals,
  topicsBySubject,
  type SubjectRef,
} from "./profile";

const SUBJECTS: SubjectRef[] = [
  { id: "s-bio", slug: "biology", name: "Biology", accent: "#39d3a1", nextExamDays: 216 },
  { id: "s-chem", slug: "chemistry", name: "Chemistry", accent: "#6b9bff", nextExamDays: 8 },
  { id: "s-econ", slug: "economics", name: "Economics", accent: "#a48bff", nextExamDays: null },
];

describe("learning profile model", () => {
  it("groups topics by subject with factual counts and 'not assessed' for thin evidence", () => {
    const [bio, chem, econ] = topicsBySubject(learningProfile(), SUBJECTS);
    expect(bio.counts).toEqual({ tracked: 3, assessed: 2, strong: 1, toImprove: 1 });
    expect(bio.topics.find((t) => t.topic === "Enzymes")?.assessed).toBe(false);
    expect(bio.topics.find((t) => t.topic === "Osmosis")).toMatchObject({ assessed: true, weak: true });
    // Assessed topics first.
    expect(bio.topics.at(-1)?.topic).toBe("Enzymes");
    // History is oldest first for the timeline.
    expect(bio.topics.find((t) => t.topic === "Cells")?.history.map((c) => c.toLevel)).toEqual([4, 5]);
    expect(chem.counts.tracked).toBe(1);
    expect(econ.counts).toEqual({ tracked: 0, assessed: 0, strong: 0, toImprove: 0 });
  });

  it("an empty profile produces no topics, insights or improvements", () => {
    const empty = { mastery: [], changes: [], insights: [], questionsAnswered: 0 };
    expect(topicsBySubject(empty, SUBJECTS).every((g) => g.topics.length === 0)).toBe(true);
    expect(strengths(empty)).toEqual([]);
    expect(areasToImprove(empty)).toEqual([]);
    expect(recentImprovements(empty, new Date("2026-11-04T12:00:00Z"))).toEqual([]);
  });

  it("recent improvements: one per topic, newest, rises only", () => {
    const up = recentImprovements(learningProfile(), new Date("2026-11-04T12:00:00Z"));
    expect(up.map((c) => `${c.topic}:${c.toLevel}`)).toEqual(["Cells:5", "Osmosis:3"]);
  });

  it("dismissed and corrected items leave the 'areas to improve' list", () => {
    const p = learningProfile();
    expect(areasToImprove(p).map((i) => i.topic)).toEqual(["Osmosis", "Osmosis"]);
    expect(areasToImprove(p)[0].kind).toBe("weakness");
    p.insights[0].status = "corrected";
    p.insights[0].studentNote = "I get it now";
    expect(areasToImprove(p).map((i) => i.kind)).toEqual(["misconception"]);
  });

  it("only treats an approach as a pattern after at least two successes", () => {
    expect(learningPatterns(learningProfile()).map((p) => p.topic)).toEqual(["Worked examples"]);
  });

  it("manageable insights exclude 'studied' bookkeeping rows", () => {
    expect(manageableInsights(learningProfile()).some((i) => i.kind === "topic_studied")).toBe(false);
  });

  it("produces recommendation signals with exam distance", () => {
    const s = topicSignals(learningProfile(), SUBJECTS);
    expect(s.find((t) => t.topic === "Bonding")).toMatchObject({ slug: "chemistry", nextExamDays: 8, level: 4 });
  });
});
