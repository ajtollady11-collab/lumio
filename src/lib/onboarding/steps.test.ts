import { describe, expect, it } from "vitest";
import { furthestAllowedStep, isComplete, resumeStep, type OnboardingFacts } from "./steps";

const blank: OnboardingFacts = {
  aboutComplete: false,
  hasQualification: false,
  subjectCount: 0,
  hasPreferences: false,
  recordedStep: 1,
};

describe("onboarding step gating", () => {
  it("keeps a new student on step 1", () => {
    expect(furthestAllowedStep(blank)).toBe(1);
    expect(resumeStep(blank, 8)).toBe(1);
  });

  it("requires qualification before subjects, and subjects before anything subject-based", () => {
    expect(furthestAllowedStep({ ...blank, aboutComplete: true })).toBe(2);
    expect(furthestAllowedStep({ ...blank, aboutComplete: true, hasQualification: true })).toBe(3);
  });

  it("lets optional steps be skipped once subjects exist", () => {
    const f = { ...blank, aboutComplete: true, hasQualification: true, subjectCount: 2, recordedStep: 4 };
    expect(furthestAllowedStep(f)).toBe(7);
    expect(isComplete(f)).toBe(false);
  });

  it("resumes where the student left off, never beyond what's allowed", () => {
    const f = { ...blank, aboutComplete: true, hasQualification: true, subjectCount: 1, recordedStep: 6 };
    expect(resumeStep(f)).toBe(6);
    expect(resumeStep(f, 8)).toBe(7); // URL can't jump to the finish
    expect(resumeStep(f, 2)).toBe(2); // going back is fine
    expect(resumeStep(f, -4)).toBe(1);
  });

  it("allows the completion screen once every required answer exists", () => {
    const f = { aboutComplete: true, hasQualification: true, subjectCount: 1, hasPreferences: true, recordedStep: 7 };
    expect(furthestAllowedStep(f)).toBe(8);
    expect(isComplete(f)).toBe(true);
  });
});
