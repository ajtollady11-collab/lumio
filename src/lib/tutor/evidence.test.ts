import { describe, expect, it } from "vitest";
import { acceptEvidence, looksPersonal } from "./evidence";

const subjects = [
  { id: "s-bio", name: "Biology" },
  { id: "s-chem", name: "Chemistry" },
];
const ok = (raw: unknown, hadPriorTutorTurn = true) => acceptEvidence(raw, { subjects, hadPriorTutorTurn });

describe("acceptEvidence", () => {
  it("accepts a well-formed answer judgement for one of the student's subjects", () => {
    expect(ok({ subject: "chemistry", topic: "  Ionic   bonding ", evidence: "correct", difficulty: "challenging", effective_approach: "analogy" })).toEqual({
      ok: true,
      evidence: {
        subjectId: "s-chem",
        topic: "Ionic bonding",
        kind: "correct",
        difficulty: "challenging",
        misconception: null,
        approach: "analogy",
        studentConfidence: null,
        nextStep: null,
      },
    });
  });

  it("never records evidence before the tutor has said anything (a question alone isn't evidence)", () => {
    expect(ok({ subject: "Biology", topic: "Osmosis", evidence: "incorrect" }, false)).toEqual({ ok: false, reason: "no prior tutor turn" });
  });

  it("rejects unknown subjects, malformed kinds and non-academic topics", () => {
    expect(ok({ subject: "Physics", topic: "Waves", evidence: "correct" })).toMatchObject({ ok: false });
    expect(ok({ subject: "Biology", topic: "Osmosis", evidence: "asked_question" })).toMatchObject({ ok: false });
    expect(ok({ subject: "Biology", topic: "email me at a@b.co", evidence: "correct" })).toMatchObject({ ok: false });
    expect(ok({ subject: "Biology", topic: "???", evidence: "correct" })).toMatchObject({ ok: false });
    expect(ok({ subject: "Biology", topic: "x".repeat(61), evidence: "correct" })).toMatchObject({ ok: false });
  });

  it("keeps misconceptions only for wrong/partial answers, and never personal ones", () => {
    const right = ok({ subject: "Biology", topic: "Osmosis", evidence: "correct", misconception: "Something" });
    expect(right.ok && right.evidence.misconception).toBeNull();
    const wrong = ok({ subject: "Biology", topic: "Osmosis", evidence: "partial", misconception: "Confuses diffusion with osmosis" });
    expect(wrong.ok && wrong.evidence.misconception).toBe("Confuses diffusion with osmosis");
    const personal = ok({ subject: "Biology", topic: "Osmosis", evidence: "incorrect", misconception: "Gets anxious because my dad shouts" });
    expect(personal.ok && personal.evidence.misconception).toBeNull();
  });

  it("only credits a teaching approach when the student actually got it", () => {
    const r = ok({ subject: "Biology", topic: "Osmosis", evidence: "needed_reexplanation", effective_approach: "visual" });
    expect(r.ok && r.evidence.approach).toBeNull();
  });
});

describe("looksPersonal", () => {
  it.each(["call 07700 900123", "me@x.com", "see https://x.y", "@alfie99", "my mum says", "I feel depressed"])("flags %j", (t) =>
    expect(looksPersonal(t)).toBe(true),
  );
  it.each(["Ionic bonding", "Le Chatelier's principle", "Year 12 quadratics", "Mitosis vs meiosis"])("allows %j", (t) =>
    expect(looksPersonal(t)).toBe(false),
  );
});
