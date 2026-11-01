import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TUTOR } from "@/lib/tutor/options";
import { encodeEvent, type TutorStreamEvent } from "@/lib/tutor/stream";

const router = { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const actions = vi.hoisted(() => ({
  deleteConversation: vi.fn(),
  renameConversation: vi.fn(),
  loadEarlierMessages: vi.fn(),
  saveTutorSettings: vi.fn(),
  forgetMemory: vi.fn(),
}));
vi.mock("@/server/tutor/actions", () => actions);

const { TutorWorkspace } = await import("./tutor-workspace");
type Props = Parameters<typeof TutorWorkspace>[0];

const CONV = "6f9a1c2e-1b2c-4d3e-8f90-1a2b3c4d5e6f";
const subjects = [
  {
    id: "s-bio",
    slug: "biology",
    name: "Biology",
    qualificationName: "A-level",
    boardName: "AQA",
    nextExamDays: 20,
    confidence: null,
  },
  {
    id: "s-maths",
    slug: "mathematics",
    name: "Mathematics",
    qualificationName: "A-level",
    boardName: null,
    nextExamDays: null,
    confidence: null,
  },
];
const base: Props = {
  firstName: "Alfie",
  tutor: { ...DEFAULT_TUTOR, name: "Sage", personality: "patient", teachingStyle: "visual" },
  tutorCustomised: true,
  subjects,
  conversations: [],
  active: null,
  ready: true,
  missing: [],
  consentRequired: false,
  remainingMessages: 900,
  initialSubjectId: null,
};

function streamOf(events: TutorStreamEvent[]) {
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const e of events) c.enqueue(encodeEvent(e));
      c.close();
    },
  });
}
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window.history, "replaceState");
  Object.values(actions).forEach((a) => a.mockReset().mockResolvedValue({ ok: true, data: null }));
  router.push.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("Tutor workspace", () => {
  it("greets the student by name with what the tutor actually knows", () => {
    render(<TutorWorkspace {...base} />);
    expect(screen.getByRole("heading", { name: "Hi Alfie — I’m Sage." })).toBeInTheDocument();
    expect(screen.getByText(/A-level Biology \(AQA\), A-level Mathematics/)).toBeInTheDocument();
    expect(screen.getByText("Patient · Visual")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Customise/ })).toHaveAttribute("href", "/app/tutor/settings");
    // Suggested questions come from real data.
    expect(
      within(screen.getByRole("list", { name: "Suggested questions" })).getAllByRole("button")[0],
    ).toHaveTextContent("Help me understand something in A-level Biology");
  });

  it("sends a message, streams the reply and files the new conversation", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      return {
        body: streamOf([
          {
            type: "start",
            conversationId: body.conversationId,
            userMessageId: "u1",
            title: "Osmosis",
            model: "claude-haiku-5-5",
          },
          { type: "delta", text: "**Osmosis** is the movement of " },
          { type: "delta", text: "water across a membrane." },
          { type: "done", messageId: "a1", interrupted: false },
        ]),
      };
    });
    render(<TutorWorkspace {...base} />);

    await user.selectOptions(screen.getByLabelText("Subject"), "s-bio");
    await user.type(screen.getByLabelText("Topic (optional)"), "Osmosis");
    await user.type(screen.getByLabelText("Message Sage"), "What is osmosis?{Enter}");

    const sent = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(sent).toMatchObject({ isNew: true, content: "What is osmosis?", subjectId: "s-bio", topic: "Osmosis" });
    expect(sent).not.toHaveProperty("studentId");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/tutor/chat");

    expect(await screen.findByText("water across a membrane.", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Osmosis", { selector: "strong" })).toBeInTheDocument(); // markdown rendered
    expect(screen.getByText("What is osmosis?")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Osmosis" })).toBeInTheDocument();
    expect(window.history.replaceState).toHaveBeenCalledWith(null, "", `/app/tutor/c/${sent.conversationId}`);
    const history = screen.getAllByRole("navigation", { name: "Conversation history" })[0];
    expect(within(history).getByRole("link", { name: /Osmosis/ })).toHaveAttribute(
      "href",
      `/app/tutor/c/${sent.conversationId}`,
    );
    expect(screen.getByLabelText("Message Sage")).toHaveValue("");
  });

  it("gives the message back and explains when the tutor can't reply", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      body: streamOf([{ type: "error", code: "rate_limited", message: "That's a lot of messages in a minute." }]),
    });
    render(<TutorWorkspace {...base} />);
    await user.type(screen.getByLabelText("Message Sage"), "Help{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("That's a lot of messages in a minute.");
    expect(screen.getByLabelText("Message Sage")).toHaveValue("Help");
    expect(screen.queryByText("Help", { selector: "li *" })).not.toBeInTheDocument();
  });

  it("handles a dropped connection without losing the message", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<TutorWorkspace {...base} />);
    await user.type(screen.getByLabelText("Message Sage"), "Explain mitosis{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(/connection dropped/);
    expect(screen.getByLabelText("Message Sage")).toHaveValue("Explain mitosis");
  });

  it("shows a clear setup message instead of a fake tutor when no AI provider is configured", () => {
    render(<TutorWorkspace {...base} ready={false} missing={["ANTHROPIC_API_KEY", "SUPABASE_SECRET_KEY"]} />);
    const notice = screen.getByRole("status", { name: "" });
    expect(screen.getByText(/isn’t connected to an AI provider yet/)).toBeInTheDocument();
    expect(screen.getByText("ANTHROPIC_API_KEY")).toBeInTheDocument();
    expect(screen.getByText("SUPABASE_SECRET_KEY")).toBeInTheDocument();
    expect(notice).toBeInTheDocument();
    expect(screen.queryByLabelText("Message Sage")).not.toBeInTheDocument();
    for (const b of within(screen.getByRole("list", { name: "Suggested questions" })).getAllByRole("button"))
      expect(b).toBeDisabled();
  });

  it("explains parental linking to under-13s instead of chatting", () => {
    render(<TutorWorkspace {...base} consentRequired />);
    expect(screen.getByText(/parent or carer needs to link first/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Message Sage")).not.toBeInTheDocument();
  });

  it("reopens an existing conversation with its saved messages", () => {
    render(
      <TutorWorkspace
        {...base}
        conversations={[
          {
            id: CONV,
            title: "Osmosis",
            subjectId: "s-bio",
            topic: "Osmosis",
            lastMessageAt: "2026-11-03T10:00:00Z",
            messageCount: 2,
          },
        ]}
        active={{
          conversation: {
            id: CONV,
            title: "Osmosis",
            subjectId: "s-bio",
            topic: "Osmosis",
            lastMessageAt: "2026-11-03T10:00:00Z",
            messageCount: 2,
          },
          hasEarlier: false,
          messages: [
            {
              id: "m1",
              role: "user",
              content: "What is osmosis?",
              status: "complete",
              createdAt: "2026-11-03T09:59:00Z",
            },
            {
              id: "m2",
              role: "assistant",
              content: "Water moves from $\\psi$ high to low.",
              status: "interrupted",
              createdAt: "2026-11-03T10:00:00Z",
            },
          ],
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Osmosis" })).toBeInTheDocument();
    expect(screen.getByText("What is osmosis?")).toBeInTheDocument();
    expect(document.querySelector(".katex")).not.toBeNull(); // maths rendered
    expect(screen.getByText("Reply stopped before it finished.")).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toHaveValue("s-bio");
    const link = within(screen.getAllByRole("navigation", { name: "Conversation history" })[0]).getByRole("link", {
      name: /Osmosis/,
    });
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("deletes a conversation after confirmation", async () => {
    const user = userEvent.setup();
    render(
      <TutorWorkspace
        {...base}
        conversations={[
          {
            id: CONV,
            title: "Osmosis",
            subjectId: null,
            topic: null,
            lastMessageAt: "2026-11-03T10:00:00Z",
            messageCount: 2,
          },
        ]}
        active={{
          conversation: {
            id: CONV,
            title: "Osmosis",
            subjectId: null,
            topic: null,
            lastMessageAt: "2026-11-03T10:00:00Z",
            messageCount: 2,
          },
          hasEarlier: false,
          messages: [{ id: "m1", role: "user", content: "Hi", status: "complete", createdAt: "2026-11-03T09:59:00Z" }],
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Conversation options" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete this conversation?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(actions.deleteConversation).toHaveBeenCalledWith(CONV);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/app/tutor"));
  });

  it("renames a conversation", async () => {
    const user = userEvent.setup();
    render(
      <TutorWorkspace
        {...base}
        active={{
          conversation: {
            id: CONV,
            title: "Osmosis",
            subjectId: null,
            topic: null,
            lastMessageAt: "2026-11-03T10:00:00Z",
            messageCount: 1,
          },
          hasEarlier: false,
          messages: [{ id: "m1", role: "user", content: "Hi", status: "complete", createdAt: "2026-11-03T09:59:00Z" }],
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Conversation options" }));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    const dialog = await screen.findByRole("dialog");
    const field = within(dialog).getByLabelText("Title");
    await user.clear(field);
    await user.type(field, "Water potential");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(actions.renameConversation).toHaveBeenCalledWith({ conversationId: CONV, title: "Water potential" });
    expect(await screen.findByRole("heading", { name: "Water potential" })).toBeInTheDocument();
  });

  it("preselects a subject passed from a subject page", () => {
    render(<TutorWorkspace {...base} initialSubjectId="s-maths" />);
    expect(screen.getByLabelText("Subject")).toHaveValue("s-maths");
    expect(
      screen.getAllByRole("button").some((b) => /key topics in A-level Mathematics/.test(b.textContent ?? "")),
    ).toBe(true);
  });
});
