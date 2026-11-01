import { describe, expect, it } from "vitest";
import { estimateCostMicros } from "@/lib/ai/models";
import { routeTutorModel, soundsStuck } from "@/lib/ai/router";
import { normaliseTurns, trimHistory } from "./context";
import { checkQuota } from "./quota";
import { chatRequestSchema, titleFromMessage, tutorSettingsSchema } from "./schemas";
import { createEventDecoder, encodeEvent } from "./stream";
import { suggestedQuestions } from "./suggestions";

const ID = "6f9a1c2e-1b2c-4d3e-8f90-1a2b3c4d5e6f";

describe("model routing", () => {
  const base = { previousUserMessages: [], complexUsed: 0, complexBudget: 100 };
  it("uses the efficient model by default", () => {
    expect(routeTutorModel({ ...base, message: "What is osmosis?" })).toMatchObject({
      model: "claude-haiku-5-5",
      tier: "efficient",
      struggling: false,
    });
  });
  it("escalates when the student is struggling or asks a long question", () => {
    expect(routeTutorModel({ ...base, message: "I still don't understand" }).tier).toBe("capable");
    expect(routeTutorModel({ ...base, message: "x".repeat(800) }).reason).toBe("long question");
  });
  it("stays efficient once the month's escalation budget is spent, but keeps the struggle signal", () => {
    expect(routeTutorModel({ ...base, complexUsed: 100, message: "this is so confusing" })).toMatchObject({
      tier: "efficient",
      struggling: true,
    });
  });
  it("recognises common ways of saying 'I'm stuck'", () => {
    for (const s of ["I don't get it", "huh", "that doesn't make sense", "can you explain it differently", "I'm lost"])
      expect(soundsStuck(s), s).toBe(true);
    for (const s of ["What is photosynthesis?", "Thanks, that makes sense!"]) expect(soundsStuck(s), s).toBe(false);
  });
});

describe("cost estimation", () => {
  it("prices tokens per model, including cache reads", () => {
    const usage = { inputTokens: 4000, outputTokens: 500, cacheWriteTokens: 0, cacheReadTokens: 2000 };
    // Haiku: 4000×0.10 + 500×0.50 + 2000×0.01 = 670 micro-dollars
    expect(estimateCostMicros("claude-haiku-5-5", usage)).toBe(670);
    // Sonnet: 4000×2 + 500×10 + 2000×0.10 = 13,200
    expect(estimateCostMicros("claude-sonnet-5-5", usage)).toBe(13_200);
    expect(estimateCostMicros("unknown-model", usage)).toBe(0);
  });
});

describe("quota", () => {
  const q = { planId: "free", allowance: 50, usedThisMonth: 10, complexUsedThisMonth: 0, lastMinute: 0, lastHour: 0 };
  it("allows within limits", () => expect(checkQuota(q)).toEqual({ ok: true, remaining: 40 }));
  it("rate-limits bursts", () => {
    expect(checkQuota({ ...q, lastMinute: 6 })).toMatchObject({ ok: false, code: "rate_limited" });
    expect(checkQuota({ ...q, lastHour: 60 })).toMatchObject({ ok: false, code: "rate_limited" });
  });
  it("stops at the monthly allowance — never unlimited", () => {
    expect(checkQuota({ ...q, usedThisMonth: 50 })).toMatchObject({ ok: false, code: "allowance_exhausted" });
    expect(checkQuota({ ...q, allowance: 0, usedThisMonth: 0 })).toMatchObject({ ok: false });
  });
});

describe("request and settings validation", () => {
  it("accepts a valid chat request and trims input", () => {
    expect(chatRequestSchema.parse({ conversationId: ID, content: "  Hi  ", topic: "  " })).toEqual({
      conversationId: ID,
      isNew: false,
      content: "Hi",
      subjectId: null,
      topic: null,
    });
  });
  it("rejects empty, over-long or malformed requests", () => {
    expect(chatRequestSchema.safeParse({ conversationId: ID, content: "   " }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ conversationId: ID, content: "x".repeat(2001) }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ conversationId: "abc", content: "Hi" }).success).toBe(false);
  });
  it("ignores any student id the browser tries to send", () => {
    const parsed = chatRequestSchema.parse({ conversationId: ID, content: "Hi", studentId: "someone-else" });
    expect(parsed).not.toHaveProperty("studentId");
  });
  it("validates tutor names", () => {
    const ok = { personality: "patient", teachingStyle: "visual", pace: "slow", depth: "simple" };
    expect(tutorSettingsSchema.safeParse({ ...ok, name: "Ms O'Neil-Smith" }).success).toBe(true);
    expect(tutorSettingsSchema.safeParse({ ...ok, name: "Zoë" }).success).toBe(true);
    expect(tutorSettingsSchema.safeParse({ ...ok, name: "<b>" }).success).toBe(false);
    expect(tutorSettingsSchema.safeParse({ ...ok, name: "x".repeat(25) }).success).toBe(false);
    expect(tutorSettingsSchema.safeParse({ ...ok, name: "Nova", personality: "sarcastic" }).success).toBe(false);
  });
});

describe("conversation helpers", () => {
  it("titles conversations from the topic or first message", () => {
    expect(titleFromMessage("What is osmosis?")).toBe("What is osmosis");
    expect(titleFromMessage("anything", "Osmosis")).toBe("Osmosis");
    expect(
      titleFromMessage("Can you explain how the light-dependent reactions of photosynthesis produce ATP and NADPH?"),
    ).toMatch(/…$/);
  });
  it("normalises history into alternating turns starting with the student", () => {
    expect(
      normaliseTurns([
        { role: "assistant", content: "orphan" },
        { role: "user", content: "a" },
        { role: "user", content: "b" },
        { role: "assistant", content: "c" },
      ]),
    ).toEqual([
      { role: "user", content: "a\n\nb" },
      { role: "assistant", content: "c" },
    ]);
  });
  it("keeps the most recent history within budget", () => {
    const turns = ["aaaa", "bbbb", "cccc"].map((content) => ({ content }));
    expect(trimHistory(turns, 9)).toEqual([{ content: "bbbb" }, { content: "cccc" }]);
  });
  it("decodes events split across network chunks", () => {
    const decode = createEventDecoder();
    const bytes = new Uint8Array([
      ...encodeEvent({ type: "delta", text: "Hel" }),
      ...encodeEvent({ type: "delta", text: "lo" }),
    ]);
    const first = decode(bytes.slice(0, 10));
    const rest = decode(bytes.slice(10), true);
    expect([...first, ...rest]).toEqual([
      { type: "delta", text: "Hel" },
      { type: "delta", text: "lo" },
    ]);
  });
  it("suggests questions from the student's real subjects and exams", () => {
    expect(
      suggestedQuestions({
        subject: { name: "Biology", qualificationName: "A-level", nextExamDays: 20, confidence: null },
        topic: null,
        firstSubjects: [],
      })[0],
    ).toBe("My Biology exam is in 20 days — how should I revise?");
    expect(
      suggestedQuestions({
        subject: { name: "Biology", qualificationName: "A-level", nextExamDays: null, confidence: null },
        topic: "Osmosis",
        firstSubjects: [],
      })[0],
    ).toBe("Explain Osmosis for A-level Biology");
  });
});
