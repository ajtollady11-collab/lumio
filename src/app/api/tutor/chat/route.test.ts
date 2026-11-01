import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEventDecoder } from "@/lib/tutor/stream";

const mocks = vi.hoisted(() => ({
  getViewerState: vi.fn(),
  tutorReadiness: vi.fn(),
  createTutorStore: vi.fn(),
  createAnthropicProvider: vi.fn(),
  runTutorTurn: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getViewerState: mocks.getViewerState }));
vi.mock("@/server/ai/config", () => ({ tutorReadiness: mocks.tutorReadiness }));
vi.mock("@/server/tutor/store", () => ({ createTutorStore: mocks.createTutorStore }));
vi.mock("@/server/ai/provider", () => ({ createAnthropicProvider: mocks.createAnthropicProvider }));
vi.mock("@/server/tutor/turn", () => ({ runTutorTurn: mocks.runTutorTurn }));

const { POST } = await import("./route");

const CONV = "6f9a1c2e-1b2c-4d3e-8f90-1a2b3c4d5e6f";
const student = { id: "student-1", role: "student", onboarded: true, displayName: "Alfie", email: "a@x" };

function post(body: unknown) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost/api/tutor/chat", {
    method: "POST",
    body: text,
    headers: { "content-type": "application/json", "content-length": String(text.length) },
  });
}
async function events(res: Response) {
  const decode = createEventDecoder();
  return decode(new Uint8Array(await res.arrayBuffer()), true);
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.getViewerState.mockResolvedValue({ status: "signed_in", viewer: student });
  mocks.tutorReadiness.mockReturnValue({ ready: true });
  mocks.createTutorStore.mockResolvedValue({});
  mocks.createAnthropicProvider.mockReturnValue({});
  mocks.runTutorTurn.mockImplementation(async function* () {
    yield { type: "delta", text: "Hi" };
    yield { type: "done", messageId: "a1", interrupted: false };
  });
});

describe("POST /api/tutor/chat", () => {
  it("requires a signed-in student who has finished onboarding", async () => {
    mocks.getViewerState.mockResolvedValueOnce({ status: "signed_out" });
    expect((await POST(post({}))).status).toBe(401);
    mocks.getViewerState.mockResolvedValueOnce({ status: "signed_in", viewer: { ...student, role: "parent" } });
    expect((await POST(post({}))).status).toBe(403);
    mocks.getViewerState.mockResolvedValueOnce({ status: "signed_in", viewer: { ...student, onboarded: false } });
    expect((await POST(post({}))).status).toBe(403);
    expect(mocks.runTutorTurn).not.toHaveBeenCalled();
  });

  it("says exactly which settings are missing instead of pretending to work", async () => {
    mocks.tutorReadiness.mockReturnValue({ ready: false, missing: ["ANTHROPIC_API_KEY"] });
    const res = await POST(post({ conversationId: CONV, content: "Hi" }));
    expect(res.status).toBe(503);
    expect(await events(res)).toEqual([
      { type: "error", code: "not_configured", message: expect.any(String), missing: ["ANTHROPIC_API_KEY"] },
    ]);
    expect(mocks.createAnthropicProvider).not.toHaveBeenCalled();
  });

  it("rejects malformed, empty and oversized input before any AI call", async () => {
    expect((await POST(post("{not json"))).status).toBe(400);
    expect((await POST(post({ conversationId: CONV, content: "" }))).status).toBe(400);
    expect((await POST(post({ conversationId: "../etc", content: "Hi" }))).status).toBe(400);
    expect((await POST(post({ conversationId: CONV, content: "x".repeat(20_000) }))).status).toBe(413);
    expect(mocks.runTutorTurn).not.toHaveBeenCalled();
  });

  it("uses the session's student id, never one from the request", async () => {
    const res = await POST(post({ conversationId: CONV, content: "Hi", studentId: "someone-else" }));
    expect(res.headers.get("content-type")).toMatch(/ndjson/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await events(res)).toEqual([
      { type: "delta", text: "Hi" },
      { type: "done", messageId: "a1", interrupted: false },
    ]);
    expect(mocks.createTutorStore).toHaveBeenCalledWith("student-1");
    const [{ request }] = mocks.runTutorTurn.mock.calls[0];
    expect(request).not.toHaveProperty("studentId");
  });

  it("turns unexpected failures into a safe message without internals", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.runTutorTurn.mockImplementation(async function* () {
      yield { type: "delta", text: "Hi" };
      throw new Error("relation secret_table does not exist");
    });
    const out = await events(await POST(post({ conversationId: CONV, content: "Hi" })));
    expect(out.at(-1)).toEqual({ type: "error", code: "unavailable", message: "Something went wrong. Try again." });
    expect(JSON.stringify(out)).not.toMatch(/secret_table/);
  });
});
