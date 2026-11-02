import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TUTOR } from "@/lib/tutor/options";

const router = { refresh: vi.fn(), push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const actions = vi.hoisted(() => ({
  saveTutorSettings: vi.fn(),
  deleteConversation: vi.fn(),
  renameConversation: vi.fn(),
  loadEarlierMessages: vi.fn(),
}));
vi.mock("@/server/tutor/actions", () => actions);

const { TutorSettingsForm, MemoryLinkCard, describeTutor } = await import("./tutor-settings-form");

beforeEach(() => {
  Object.values(actions).forEach((a) => a.mockReset().mockResolvedValue({ ok: true, data: null }));
  router.refresh.mockReset();
});

describe("Tutor customisation", () => {
  it("previews how the tutor will teach and saves every setting", async () => {
    const user = userEvent.setup();
    render(<TutorSettingsForm initial={DEFAULT_TUTOR} customised={false} />);
    const name = screen.getByLabelText("Tutor name");
    await user.clear(name);
    await user.type(name, "Professor Pip");
    await user.click(screen.getByRole("radio", { name: /Strict but supportive/ }));
    await user.click(screen.getByRole("radio", { name: /Question-led/ }));
    await user.click(screen.getByRole("radio", { name: "Slow" }));
    await user.click(screen.getByRole("radio", { name: "Detailed" }));

    expect(screen.getByText(/^I’m Professor Pip\. High standards/)).toHaveTextContent(
      "question-led way — guides you with questions so you work it out — at a slow pace (small steps, frequent checks), with detailed explanations",
    );

    await user.click(screen.getByRole("button", { name: "Save tutor" }));
    expect(actions.saveTutorSettings).toHaveBeenCalledWith({
      name: "Professor Pip",
      personality: "strict_supportive",
      teachingStyle: "question_led",
      pace: "slow",
      depth: "detailed",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Saved — Professor Pip will use these settings");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows the server's validation message", async () => {
    const user = userEvent.setup();
    actions.saveTutorSettings.mockResolvedValueOnce({
      ok: false,
      error: "invalid",
      message: "Use letters…",
      fieldErrors: { name: "Use letters, numbers, spaces, apostrophes, full stops or hyphens." },
    });
    render(<TutorSettingsForm initial={DEFAULT_TUTOR} customised />);
    await user.type(screen.getByLabelText("Tutor name"), "!");
    await user.click(screen.getByRole("button", { name: "Save tutor" }));
    expect(await screen.findByText(/Use letters, numbers/)).toBeInTheDocument();
  });

  it("describes the defaults", () => {
    expect(describeTutor(DEFAULT_TUTOR)).toMatch(/^I’m Nova\. Warm and relaxed/);
  });
});

describe("Memory link card", () => {
  it("points to the learning profile and says parents can't see it", () => {
    render(<MemoryLinkCard count={4} tutorName="Sage" />);
    expect(screen.getByRole("heading", { name: "What Sage remembers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open My Learning Profile/ })).toHaveAttribute(
      "href",
      "/app/progress#memory",
    );
    expect(screen.getByText(/Parents can’t see this/)).toBeInTheDocument();
  });

  it("says plainly when nothing is recorded", () => {
    render(<MemoryLinkCard count={0} tutorName="Sage" />);
    expect(screen.getByText(/Nothing recorded yet/)).toBeInTheDocument();
  });
});
