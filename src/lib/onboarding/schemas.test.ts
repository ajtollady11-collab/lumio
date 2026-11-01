import { describe, expect, it } from "vitest";
import { GRADE_SCALES, gradeIsValid } from "./options";
import { aboutSchema, examSchema, goalsSchema, inviteCodeSchema, londonToday, subjectsSchema } from "./schemas";

const ID = "6f9a1c2e-1b2c-4d3e-8f90-1a2b3c4d5e6f";

describe("aboutSchema", () => {
  it("accepts a complete answer and coerces the school year", () => {
    const r = aboutSchema.parse({ firstName: " Zoë ", ageBand: "16_17", schoolYear: "12", educationLevel: "a_level" });
    expect(r).toEqual({ firstName: "Zoë", ageBand: "16_17", schoolYear: 12, educationLevel: "a_level" });
  });

  it("explains each missing answer", () => {
    const r = aboutSchema.safeParse({ firstName: "", ageBand: null, schoolYear: null, educationLevel: undefined });
    expect(r.success).toBe(false);
    if (!r.success) {
      const fields = r.error.issues.map((i) => i.path[0]);
      expect(fields).toEqual(expect.arrayContaining(["firstName", "ageBand", "schoolYear", "educationLevel"]));
    }
  });
});

describe("subjectsSchema", () => {
  it("needs at least one subject and no duplicates", () => {
    expect(subjectsSchema.safeParse({ subjectIds: [] }).success).toBe(false);
    expect(subjectsSchema.safeParse({ subjectIds: [ID, ID] }).success).toBe(false);
    expect(subjectsSchema.safeParse({ subjectIds: [ID] }).success).toBe(true);
  });
});

describe("goalsSchema", () => {
  it("treats empty grades and goals as not given", () => {
    const r = goalsSchema.parse({
      entries: [{ subjectId: ID, currentGrade: "", targetGrade: "A*", confidence: null }],
      academicGoals: "   ",
    });
    expect(r.entries[0].currentGrade).toBeNull();
    expect(r.academicGoals).toBeNull();
  });
});

describe("examSchema", () => {
  const schema = examSchema("2026-11-01");

  it("accepts a date in the next three years", () => {
    expect(schema.safeParse({ subjectId: ID, examDate: "2027-06-08", notes: "Paper 1" }).success).toBe(true);
    expect(schema.safeParse({ subjectId: ID, examDate: "2026-11-01", notes: null }).success).toBe(true);
  });

  it.each([
    ["2026-10-31", "That date has already passed."],
    ["2030-01-01", "Choose a date within the next three years."],
    ["", "Choose the exam date."],
    ["2027-02-30", "That date isn't valid."],
  ])("rejects %j", (examDate, message) => {
    const r = schema.safeParse({ subjectId: ID, examDate, notes: null });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe(message);
  });
});

describe("inviteCodeSchema", () => {
  it("ignores case, spaces and dashes", () => {
    expect(inviteCodeSchema.parse(" abcd-efgh jkmn ")).toBe("ABCDEFGHJKMN");
  });
  it("rejects codes of the wrong length", () => {
    expect(inviteCodeSchema.safeParse("ABCD-EFGH").success).toBe(false);
  });
});

describe("grades", () => {
  it("matches each qualification's scale", () => {
    expect(gradeIsValid("gcse", "9")).toBe(true);
    expect(gradeIsValid("gcse", "A*")).toBe(false);
    expect(gradeIsValid("a_level", "A*")).toBe(true);
    expect(gradeIsValid("as_level", "A*")).toBe(false);
    expect(gradeIsValid("igcse", null)).toBe(true);
    expect(GRADE_SCALES.a_level[0]).toBe("A*");
  });
});

describe("londonToday", () => {
  it("uses UK local date across midnight in summer time", () => {
    // 23:30 UTC on 30 June is 00:30 on 1 July in London (BST).
    expect(londonToday(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
    // In winter London is on UTC.
    expect(londonToday(new Date("2026-12-31T23:30:00Z"))).toBe("2026-12-31");
  });
});
