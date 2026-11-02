import { describe, expect, it } from "vitest";
import {
  DEFAULT_TUTOR,
  DEPTHS,
  PACES,
  PERSONALITIES,
  TEACHING_STYLES,
  defaultTutorFor,
  type TutorSettings,
} from "./options";
import {
  buildTutorSystem,
  curriculumSection,
  learningSection,
  studentSection,
  TEACHING_FOUNDATION,
  type StudentContext,
} from "./prompt";

const student: StudentContext = {
  today: "2026-11-04",
  firstName: "Alfie",
  ageBand: "16_17",
  schoolYear: 12,
  educationLevel: "a_level",
  learningPreferences: ["visual", "example_based"],
  academicGoals: "Get an A* in Biology",
  subjects: [
    {
      subjectId: "s-bio",
      name: "Biology",
      qualificationName: "A-level",
      boardName: "AQA",
      currentGrade: "B",
      targetGrade: "A*",
      confidence: "difficult",
      nextExam: { date: "2027-06-08", days: 216 },
      assessment: null,
      lastStudiedDate: null,
    },
    {
      subjectId: "s-maths",
      name: "Mathematics",
      qualificationName: "GCSE",
      boardName: null,
      currentGrade: null,
      targetGrade: null,
      confidence: null,
      nextExam: null,
      assessment: { averagePercent: 64.5, count: 3 },
      lastStudiedDate: "2026-11-01",
    },
  ],
  learning: { topics: [], insights: [], patterns: [], knownTopics: [] },
};

const system = (tutor: TutorSettings, s = student) =>
  buildTutorSystem({ tutor, student: s, focus: { subject: null, topic: null, struggling: false } });

describe("tutor system prompt", () => {
  it("keeps the shared foundation identical for every student (cacheable)", () => {
    const a = system(DEFAULT_TUTOR);
    const b = system({ ...DEFAULT_TUTOR, name: "Sage" }, { ...student, firstName: "Ben" });
    expect(a.foundation).toBe(b.foundation);
    expect(a.foundation).toBe(TEACHING_FOUNDATION);
    expect(a.foundation).not.toMatch(/Alfie|Ben/);
  });

  it("includes the core teaching, honesty and safeguarding rules", () => {
    expect(TEACHING_FOUNDATION).toMatch(/do NOT repeat your previous explanation/);
    expect(TEACHING_FOUNDATION).toMatch(/never praise an incorrect answer/);
    expect(TEACHING_FOUNDATION).toMatch(/Never invent the student's grades/);
    expect(TEACHING_FOUNDATION).toMatch(/Never claim to have past papers/);
    expect(TEACHING_FOUNDATION).toMatch(/Childline 0800 1111/);
    expect(TEACHING_FOUNDATION).toMatch(/Never write coursework/);
  });

  it.each([
    ["personality", PERSONALITIES],
    ["teachingStyle", TEACHING_STYLES],
    ["pace", PACES],
    ["depth", DEPTHS],
  ] as const)("every %s option changes what the tutor is told", (key, options) => {
    const prompts = options.map((o) => system({ ...DEFAULT_TUTOR, [key]: o.value }).personal);
    expect(new Set(prompts).size).toBe(options.length);
    options.forEach((o, i) => expect(prompts[i]).toContain(o.instruction));
  });

  it("uses the tutor's chosen name", () => {
    expect(system({ ...DEFAULT_TUTOR, name: "Professor Pip" }).personal).toContain("Your name is Professor Pip.");
  });

  it("states only stored facts about the student", () => {
    const record = studentSection(student);
    expect(record).toContain("First name: Alfie.");
    expect(record).toContain("Age range: 16–17.");
    expect(record).toContain("School year: Year 12.");
    expect(record).toContain(
      "A-level Biology; exam board AQA; currently working at B (their own estimate); target A*; finds it difficult; next exam 2027-06-08 (216 days away); no assessed work in Lumio yet.",
    );
    expect(record).toContain(
      "GCSE Mathematics; exam board not yet chosen; average 65% across 3 assessed activities in Lumio.",
    );
    expect(record).toContain('Their goals, in their words: "Get an A* in Biology"');
    expect(record).not.toMatch(/Recorded learning|<learning_profile>/); // learning memory lives in its own, scoped section
  });

  it("describes only the recorded learning it was given, in plain terms", () => {
    const section = learningSection({
      topics: [
        { subjectName: "Biology", topic: "Osmosis", level: 3, evidenceCount: 4, correctCount: 1, incorrectCount: 3, isFocus: true },
        { subjectName: "Biology", topic: "Enzymes", level: 2, evidenceCount: 1, correctCount: 1, incorrectCount: 0, isFocus: false },
      ],
      insights: [
        { kind: "misconception", subjectName: "Biology", topic: "Osmosis", detail: "Thinks solute moves, not water", confirmed: false, studentNote: null, confidence: "medium", evidenceSummary: null },
        { kind: "weakness", subjectName: "Biology", topic: "Osmosis", detail: null, confirmed: false, studentNote: null, confidence: "medium", evidenceSummary: "3 incorrect — since 2 Nov" },
        { kind: "strength", subjectName: "Biology", topic: "Cells", detail: null, confirmed: false, studentNote: "I struggle with this actually", confidence: "medium", evidenceSummary: null },
      ],
      patterns: [{ approach: "Worked examples", occurrences: 3 }],
      knownTopics: ["Osmosis", "Enzymes"],
    });
    expect(section).toContain("- [current topic] Biology: Osmosis — Developing understanding (1 right, 3 wrong of 4 recorded).");
    expect(section).toContain("- Biology: Enzymes — introduced, not assessed yet.");
    expect(section).toContain("previous misconception: Thinks solute moves, not water.");
    expect(section).toContain("needs more work (3 incorrect — since 2 Nov)");
    expect(section).toContain('the student corrected an earlier note: "I struggle with this actually". Trust their correction.');
    expect(section).toContain("worked examples (3 times)");
    expect(section).toContain("reuse when recording evidence): Osmosis; Enzymes.");
  });

  it("says plainly when nothing is recorded, and asks the tutor not to assume", () => {
    expect(learningSection({ topics: [], insights: [], patterns: [], knownTopics: [] })).toContain(
      "Nothing recorded yet for this subject or topic. Don't assume prior knowledge either way.",
    );
  });

  it("tells the tutor how to adapt and when (not) to record evidence", () => {
    expect(TEACHING_FOUNDATION).toMatch(/Strong or Mastered: don't re-teach from the beginning/);
    expect(TEACHING_FOUNDATION).toMatch(/try a different approach from before/);
    expect(TEACHING_FOUNDATION).toMatch(/Do NOT call it when they simply ask a question/);
    expect(TEACHING_FOUNDATION).toMatch(/never feelings, family, health or anything personal/);
    expect(system(DEFAULT_TUTOR).personal).toContain("<learning_profile>");
  });

  it("separates verified specification content from general knowledge", () => {
    const unverified = curriculumSection({
      subjectName: "Biology",
      qualificationName: "A-level",
      boardName: "AQA",
      specification: null,
    });
    expect(unverified).toContain("does not yet hold verified specification content");
    expect(unverified).toContain("suggest checking the AQA specification");
    const noBoard = curriculumSection({
      subjectName: "Maths",
      qualificationName: "GCSE",
      boardName: null,
      specification: null,
    });
    expect(noBoard).toContain("ask which board they're sitting");
    const verified = curriculumSection({
      subjectName: "Biology",
      qualificationName: "A-level",
      boardName: "AQA",
      specification: { code: "7402", title: "AQA A-level Biology", topics: ["Biological molecules"] },
    });
    expect(verified).toContain("Verified specification on record: AQA A-level Biology (7402)");
  });

  it("tells the tutor to change approach when the student is struggling", () => {
    const p = buildTutorSystem({
      tutor: DEFAULT_TUTOR,
      student,
      focus: { subject: null, topic: "Osmosis", struggling: true },
    }).personal;
    expect(p).toContain('The student chose the topic: "Osmosis".');
    expect(p).toMatch(/try a clearly different approach/);
  });

  it("starts the default tutor in the student's preferred learning style", () => {
    expect(defaultTutorFor(["example_based"]).teachingStyle).toBe("example_based");
    expect(defaultTutorFor([]).teachingStyle).toBe("conversational");
  });
});
