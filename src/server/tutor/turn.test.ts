import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TutorContextRow } from "@/lib/tutor/context";
import type { TutorStreamEvent } from "@/lib/tutor/stream";
import { ProviderError, type ChatChunk, type ChatProvider, type ChatProviderRequest } from "@/server/ai/provider";
import { runTutorTurn, type TutorStore } from "./turn";

const CONV = "6f9a1c2e-1b2c-4d3e-8f90-1a2b3c4d5e6f";
const names = {
  qualifications: [{ id: "q-a", name: "A-level" }],
  examBoards: [{ id: "b-aqa", name: "AQA" }],
  subjects: [{ id: "s-bio", name: "Biology" }],
};

function row(overrides: Partial<TutorContextRow> = {}): TutorContextRow {
  return {
    today: "2026-11-04",
    quota: {
      planId: "premium",
      allowance: 1000,
      usedThisMonth: 3,
      complexUsedThisMonth: 0,
      lastMinute: 0,
      lastHour: 0,
    },
    profile: {
      firstName: "Alfie",
      ageBand: "16_17",
      schoolYear: 12,
      educationLevel: "a_level",
      learningPreferences: ["visual"],
      academicGoals: null,
      parentalConsent: "not_required",
    },
    tutor: { name: "Sage", personality: "patient", teachingStyle: "visual", pace: "slow", depth: "simple" },
    subjects: [
      {
        subjectId: "s-bio",
        qualificationId: "q-a",
        examBoardId: "b-aqa",
        currentGrade: null,
        targetGrade: "A*",
        confidence: null,
        nextExam: null,
        assessedCount: 0,
        averagePercent: null,
        lastStudiedDate: null,
      },
    ],
    memory: [],
    conversation: null,
    history: [],
    ...overrides,
  };
}

function fakeStore(r: TutorContextRow | null = row()) {
  const calls = {
    created: [] as unknown[],
    userMessages: [] as string[],
    assistant: [] as { content: string; status: string; model: string }[],
    deleted: [] as string[],
    usage: [] as { feature: string; model: string; costMicros: number; usage: unknown }[],
    remembered: [] as string[],
    activity: [] as string[],
  };
  const store: TutorStore = {
    asStudent: {
      context: vi.fn(async () => r),
      createConversation: vi.fn(async (c) => (calls.created.push(c), "ok" as const)),
      updateConversationFocus: vi.fn(async () => {}),
      insertUserMessage: vi.fn(
        async (_id: string, content: string) => (calls.userMessages.push(content), { id: "u1" }),
      ),
      specification: vi.fn(async () => null),
    },
    asServer: {
      insertAssistantMessage: vi.fn(async (m) => (calls.assistant.push(m), { id: "a1" })),
      deleteMessage: vi.fn(async (id: string) => void calls.deleted.push(id)),
      recordUsage: vi.fn(async (u) => void calls.usage.push(u)),
      rememberTopic: vi.fn(async (_s: string, t: string) => void calls.remembered.push(t)),
      recordTutorActivity: vi.fn(async (id: string) => void calls.activity.push(id)),
    },
    names: vi.fn(async () => names),
  };
  return { store, calls };
}

function fakeProvider(script: (req: ChatProviderRequest) => AsyncIterable<ChatChunk>) {
  const requests: ChatProviderRequest[] = [];
  const provider: ChatProvider = {
    id: "anthropic",
    stream: (req) => {
      requests.push(req);
      return script(req);
    },
  };
  return { provider, requests };
}

async function* reply(text: string): AsyncIterable<ChatChunk> {
  for (const word of text.split(/(?<= )/)) yield { type: "text", text: word };
  yield {
    type: "end",
    usage: { inputTokens: 3000, outputTokens: 120, cacheWriteTokens: 0, cacheReadTokens: 2000 },
    requestId: "msg_1",
    stopReason: "end_turn",
  };
}

async function collect(gen: AsyncGenerator<TutorStreamEvent>) {
  const events: TutorStreamEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

const request = (o: Partial<Parameters<typeof runTutorTurn>[0]["request"]> = {}) => ({
  conversationId: CONV,
  isNew: true,
  content: "What is osmosis?",
  subjectId: "s-bio",
  topic: "Osmosis",
  ...o,
});

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

describe("runTutorTurn", () => {
  it("creates the conversation, streams the reply and saves everything", async () => {
    const { store, calls } = fakeStore();
    const { provider, requests } = fakeProvider(() => reply("Osmosis is the movement of water."));
    const events = await collect(runTutorTurn({ request: request() }, store, provider));

    expect(events[0]).toMatchObject({
      type: "start",
      conversationId: CONV,
      title: "Osmosis",
      model: "claude-haiku-5-5",
    });
    expect(
      events
        .filter((e) => e.type === "delta")
        .map((e) => (e as { text: string }).text)
        .join(""),
    ).toBe("Osmosis is the movement of water.");
    expect(events.at(-1)).toEqual({ type: "done", messageId: "a1", interrupted: false });

    expect(calls.created).toEqual([{ id: CONV, title: "Osmosis", subjectId: "s-bio", topic: "Osmosis" }]);
    expect(calls.userMessages).toEqual(["What is osmosis?"]);
    expect(calls.assistant).toEqual([
      {
        conversationId: CONV,
        content: "Osmosis is the movement of water.",
        status: "complete",
        model: "claude-haiku-5-5",
      },
    ]);
    expect(calls.usage[0]).toMatchObject({
      feature: "tutor.chat",
      model: "claude-haiku-5-5",
      costMicros: 380,
      requestId: "msg_1",
    });
    expect(calls.remembered).toEqual(["Osmosis"]);
    expect(calls.activity).toEqual([CONV]);

    // The prompt carries the student's settings and record; the foundation is marked for caching.
    const sent = requests[0];
    expect(sent.system[0].cache).toBe(true);
    expect(sent.system[1].text).toContain("Your name is Sage.");
    expect(sent.system[1].text).toContain("A-level Biology; exam board AQA");
    expect(sent.system[1].text).toContain('The student chose the topic: "Osmosis".');
    expect(sent.maxTokens).toBe(700); // depth: simple
    expect(sent.messages).toEqual([{ role: "user", content: "What is osmosis?" }]);
  });

  it("continues an existing conversation with its history", async () => {
    const { store, calls } = fakeStore(
      row({
        conversation: { id: CONV, title: "Osmosis", subjectId: "s-bio", topic: "Osmosis", messageCount: 2 },
        history: [
          { role: "user", content: "What is osmosis?" },
          { role: "assistant", content: "It's the movement of water…" },
        ],
      }),
    );
    const { provider, requests } = fakeProvider(() => reply("Let's try another way."));
    await collect(
      runTutorTurn({ request: request({ isNew: false, content: "I still don't get it" }) }, store, provider),
    );
    expect(calls.created).toEqual([]);
    expect(requests[0].messages).toHaveLength(3);
    // Struggle → capable model and a "change approach" signal.
    expect(requests[0].model).toBe("claude-sonnet-5-5");
    expect(requests[0].system[1].text).toMatch(/try a clearly different approach/);
    expect(calls.usage[0].feature).toBe("tutor.chat.complex");
    expect(calls.activity).toEqual([]); // only recorded on the first exchange
  });

  it("refuses a conversation that isn't the student's (or doesn't exist)", async () => {
    const { store, calls } = fakeStore(row({ conversation: null }));
    const { provider, requests } = fakeProvider(() => reply("x"));
    const events = await collect(runTutorTurn({ request: request({ isNew: false }) }, store, provider));
    expect(events).toEqual([{ type: "error", code: "not_found", message: expect.any(String) }]);
    expect(requests).toHaveLength(0);
    expect(calls.userMessages).toHaveLength(0);
  });

  it("refuses subjects the student doesn't take", async () => {
    const { store } = fakeStore();
    const { provider } = fakeProvider(() => reply("x"));
    const [event] = await collect(runTutorTurn({ request: request({ subjectId: "s-other" }) }, store, provider));
    expect(event).toMatchObject({ type: "error", code: "invalid" });
  });

  it("blocks under-13s until a parent has linked", async () => {
    const { store } = fakeStore(row({ profile: { ...row().profile, parentalConsent: "pending" } }));
    const { provider, requests } = fakeProvider(() => reply("x"));
    const [event] = await collect(runTutorTurn({ request: request() }, store, provider));
    expect(event).toMatchObject({ type: "error", code: "consent_required" });
    expect(requests).toHaveLength(0);
  });

  it("enforces the monthly allowance and rate limit before calling the AI", async () => {
    const used = fakeStore(row({ quota: { ...row().quota, usedThisMonth: 1000 } }));
    const p1 = fakeProvider(() => reply("x"));
    expect((await collect(runTutorTurn({ request: request() }, used.store, p1.provider)))[0]).toMatchObject({
      code: "allowance_exhausted",
    });
    const burst = fakeStore(row({ quota: { ...row().quota, lastMinute: 6 } }));
    const p2 = fakeProvider(() => reply("x"));
    expect((await collect(runTutorTurn({ request: request() }, burst.store, p2.provider)))[0]).toMatchObject({
      code: "rate_limited",
    });
    expect(p1.requests.length + p2.requests.length).toBe(0);
  });

  it("removes the unanswered message and explains when the provider fails", async () => {
    const { store, calls } = fakeStore();
    const { provider } = fakeProvider(() => ({
      async *[Symbol.asyncIterator]() {
        throw new ProviderError("overloaded", "529");
      },
    }));
    const events = await collect(runTutorTurn({ request: request() }, store, provider));
    expect(events.at(-1)).toMatchObject({
      type: "error",
      code: "provider_error",
      message: expect.stringMatching(/busy/),
    });
    expect(calls.deleted).toEqual(["u1"]);
    expect(calls.assistant).toHaveLength(0);
    expect(calls.usage).toHaveLength(0);
  });

  it("keeps a partial reply as 'interrupted' if the student stops it", async () => {
    const { store, calls } = fakeStore();
    const { provider } = fakeProvider(() => ({
      async *[Symbol.asyncIterator]() {
        yield { type: "text" as const, text: "Osmosis is" };
        throw new ProviderError("aborted", "stopped");
      },
    }));
    const events = await collect(runTutorTurn({ request: request() }, store, provider));
    expect(events.at(-1)).toEqual({ type: "done", messageId: "a1", interrupted: true });
    expect(calls.assistant[0]).toMatchObject({ content: "Osmosis is", status: "interrupted" });
    // Usage still recorded (estimated, since the provider never reported it).
    expect(calls.usage[0].usage).toMatchObject({ outputTokens: 3 });
  });

  it("reports the database being unreachable without calling the AI", async () => {
    const { store } = fakeStore(null);
    const { provider, requests } = fakeProvider(() => reply("x"));
    expect(await collect(runTutorTurn({ request: request() }, store, provider))).toEqual([
      { type: "error", code: "unavailable", message: expect.any(String) },
    ]);
    expect(requests).toHaveLength(0);
  });

  it("uses default tutor settings (from learning preferences) before the student customises", async () => {
    const { store } = fakeStore(row({ tutor: null }));
    const { provider, requests } = fakeProvider(() => reply("Hi"));
    await collect(runTutorTurn({ request: request() }, store, provider));
    expect(requests[0].system[1].text).toContain("Your name is Nova.");
    expect(requests[0].system[1].text).toContain("Teaching style: Visual.");
  });
});
