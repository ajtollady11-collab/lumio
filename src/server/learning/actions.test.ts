import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The server actions are the only write path students have to their learning
 * memory. These tests pin the checks that run BEFORE the database (role,
 * input validation) and that every write is scoped to the session's own id.
 * Row-level isolation itself is proven against Postgres in
 * supabase/tests/learning_intelligence.sql.
 */

const viewer = vi.hoisted(() => ({
  state: { status: "signed_in", viewer: { id: "student-a", role: "student" } } as unknown,
}));
vi.mock("@/lib/auth/session", () => ({ getViewerState: async () => viewer.state }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

type Call = {
  table?: string;
  rpc?: string;
  op?: string;
  values?: unknown;
  filters: [string, unknown][];
  args?: unknown;
};
const calls: Call[] = [];
let result: { data: unknown; error: unknown } = { data: [{ id: "x" }], error: null };

function builder(call: Call) {
  const b = {
    update(values: unknown) {
      call.op = "update";
      call.values = values;
      return b;
    },
    delete() {
      call.op = "delete";
      return b;
    },
    eq(col: string, val: unknown) {
      call.filters.push([col, val]);
      return b;
    },
    select() {
      return b;
    },
    then(resolve: (r: unknown) => void) {
      resolve(result);
    },
  };
  return b;
}
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from(table: string) {
      const c: Call = { table, filters: [] };
      calls.push(c);
      return builder(c);
    },
    async rpc(name: string, args?: unknown) {
      calls.push({ rpc: name, args, filters: [] });
      return result;
    },
  }),
}));

const { updateInsight, deleteInsight, resetTopic, clearLearningMemory } = await import("./actions");
const ID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  calls.length = 0;
  result = { data: [{ id: ID }], error: null };
  viewer.state = { status: "signed_in", viewer: { id: "student-a", role: "student" } };
});

describe("learning memory actions", () => {
  it("scopes every update to the signed-in student, never a browser-supplied student id", async () => {
    const r = await updateInsight({ id: ID, action: "confirm", studentId: "student-b" });
    expect(r.ok).toBe(true);
    expect(calls[0]).toMatchObject({
      table: "student_memory",
      op: "update",
      values: { status: "confirmed", student_note: null },
    });
    expect(calls[0].filters).toEqual([
      ["id", ID],
      ["student_id", "student-a"],
    ]);
  });

  it("requires a real note to correct an insight", async () => {
    const r = await updateInsight({ id: ID, action: "correct", note: " " });
    expect(r).toMatchObject({ ok: false, error: "invalid" });
    expect(calls).toHaveLength(0);
    const ok = await updateInsight({ id: ID, action: "correct", note: "  I get it now  " });
    expect(ok.ok).toBe(true);
    expect(calls[0].values).toEqual({ status: "corrected", student_note: "I get it now" });
  });

  it("rejects malformed ids and unknown actions", async () => {
    expect((await updateInsight({ id: "nope", action: "confirm" })).ok).toBe(false);
    expect((await updateInsight({ id: ID, action: "promote" })).ok).toBe(false);
    expect((await deleteInsight("1 or 1=1")).ok).toBe(false);
    expect((await resetTopic({ subjectId: ID, topicKey: "Osmosis; drop" })).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("reports not_found when the row isn't the student's (RLS returned nothing)", async () => {
    result = { data: [], error: null };
    expect(await updateInsight({ id: ID, action: "dismiss" })).toMatchObject({ ok: false, error: "not_found" });
  });

  it("refuses parents and signed-out visitors before touching the database", async () => {
    viewer.state = { status: "signed_in", viewer: { id: "parent-1", role: "parent" } };
    expect((await deleteInsight(ID)).ok).toBe(false);
    expect((await clearLearningMemory("clear")).ok).toBe(false);
    viewer.state = { status: "signed_out" };
    expect(await updateInsight({ id: ID, action: "confirm" })).toMatchObject({ ok: false, error: "session_expired" });
    expect(calls).toHaveLength(0);
  });

  it("clears everything only with the explicit confirmation token", async () => {
    expect((await clearLearningMemory(true)).ok).toBe(false);
    expect(calls).toHaveLength(0);
    expect((await clearLearningMemory("clear")).ok).toBe(true);
    expect(calls[0].rpc).toBe("clear_learning_memory");
  });

  it("resets one topic through the RPC", async () => {
    expect((await resetTopic({ subjectId: ID, topicKey: "osmosis" })).ok).toBe(true);
    expect(calls[0]).toMatchObject({ rpc: "reset_learning_topic", args: { p_subject: ID, p_topic_key: "osmosis" } });
  });
});
