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
  memory: [],
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
    expect(record).toContain("Recorded learning history: none yet.");
  });

  it("lists only recorded memory items", () => {
    const record = studentSection({
      ...student,
      memory: [{ kind: "topic_studied", subjectName: "Biology", topic: "Osmosis", detail: null, occurrences: 3 }],
    });
    expect(record).toContain("- Biology: Osmosis — studied with you (3 times).");
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
