import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildExams, buildSubjects } from "@/lib/dashboard/model";
import { EMPTY_PROFILE } from "@/lib/learning/profile";
import { REF, TODAY, emptyActivity, learningProfile, profile } from "@/test/dashboard-fixtures";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn(), push: vi.fn() }) }));
const actions = vi.hoisted(() => ({
  updateInsight: vi.fn(),
  deleteInsight: vi.fn(),
  resetTopic: vi.fn(),
  clearLearningMemory: vi.fn(),
}));
vi.mock("@/server/learning/actions", () => actions);

const { LearningProfile } = await import("./learning-profile");

const ok = { ok: true, data: null };
beforeEach(() => {
  for (const a of Object.values(actions)) a.mockReset().mockResolvedValue(ok);
  refresh.mockReset();
});

function renderProfile(learning = learningProfile()) {
  const p = profile();
  const activity = emptyActivity();
  return render(
    <LearningProfile
      profile={learning}
      subjects={buildSubjects(p, REF, activity)}
      exams={buildExams(p, REF, TODAY)}
      activity={activity}
      tutor={{ name: "Sage", teachingStyle: "visual" }}
      learningPreferences={["visual", "example_based"]}
    />,
  );
}
const region = (name: string | RegExp) => screen.getByRole("region", { name });

describe("My Learning Profile — empty", () => {
  it("explains how it fills and shows no invented figures", () => {
    renderProfile(EMPTY_PROFILE);
    expect(screen.getByText("Nothing recorded yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start with Sage" })).toHaveAttribute("href", "/app/tutor");
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    for (const term of ["Topics tracked", "Questions answered", "Strong or mastered", "Areas to improve"]) {
      expect(screen.getAllByText(term)[0].closest("div")).toHaveTextContent(`${term}0`);
    }
    expect(screen.queryByRole("button", { name: "Clear all learning memory" })).not.toBeInTheDocument();
    // Preferences still show as the starting point.
    expect(within(region("How you learn best")).getByText("Visual explanations")).toBeInTheDocument();
  });
});

describe("My Learning Profile — with evidence", () => {
  it("shows real counts, strengths, areas to improve and improvements", () => {
    renderProfile();
    expect(screen.getByText("Questions answered").closest("div")).toHaveTextContent("15");
    expect(screen.getByText("Topics tracked").closest("div")).toHaveTextContent("4");
    expect(within(region("Strengths")).getByText("Cells")).toBeInTheDocument();
    const improve = region("Areas to improve");
    expect(within(improve).getAllByText("Osmosis")).toHaveLength(2);
    expect(within(improve).getByText("Thinks solute moves rather than water")).toBeInTheDocument();
    // Dismissed weakness isn't presented.
    expect(within(improve).queryByText("Moles")).not.toBeInTheDocument();
    expect(within(region("Recent improvements")).getByText(/Good → Strong/)).toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
  });

  it("labels thin evidence 'Not assessed yet' and explains levels", () => {
    renderProfile();
    const mastery = region("Topic mastery");
    expect(within(mastery).getByRole("img", { name: "Enzymes: Not assessed yet" })).toBeInTheDocument();
    expect(within(mastery).getByRole("img", { name: "Cells: Strong understanding" })).toBeInTheDocument();
    expect(within(mastery).getByText("How levels are worked out")).toBeInTheDocument();
  });

  it("only shows learning patterns seen at least twice", () => {
    renderProfile();
    const how = region("How you learn best");
    expect(within(how).getByText("Worked examples")).toBeInTheDocument();
    expect(within(how).queryByText("Analogies")).not.toBeInTheDocument();
  });

  it("recommends next steps from topic mastery with tutor links", () => {
    renderProfile();
    const links = within(region("Recommended next steps")).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toContain("/app/tutor?subject=biology&topic=Osmosis");
  });

  it("expands a topic to show the evidence and resets it after confirmation", async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(within(region("Topic mastery")).getByRole("button", { name: /Osmosis/ }));
    expect(screen.getByText("Answers recorded").nextSibling).toHaveTextContent("4");
    await user.click(screen.getByRole("button", { name: "Reset topic" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Reset topic" }));
    expect(actions.resetTopic).toHaveBeenCalledWith({ subjectId: "s-bio", topicKey: "osmosis" });
    expect(refresh).toHaveBeenCalled();
  });
});

describe("My Learning Profile — memory management", () => {
  const memory = () => region("What Sage remembers");

  it("lists each insight with when and why, and says parents can't see it", () => {
    renderProfile();
    const m = memory();
    expect(within(m).getAllByText("Biology · Osmosis", { selector: "p" })).toHaveLength(2); // weakness + misconception
    expect(within(m).getByText("1 correct, 3 incorrect — since 28 Oct")).toBeInTheDocument();
    expect(within(m).getAllByText(/Recorded 28 Oct 2026 · updated 3 Nov 2026/).length).toBeGreaterThan(0);
    expect(within(m).getByText(/parents can’t/)).toBeInTheDocument();
    expect(within(m).queryByText("Enzymes")).not.toBeInTheDocument(); // bookkeeping row
  });

  it("confirms, dismisses and deletes individual items", async () => {
    const user = userEvent.setup();
    renderProfile();
    const first = within(memory()).getAllByRole("listitem")[0];
    await user.click(within(first).getByRole("button", { name: "That’s right" }));
    expect(actions.updateInsight).toHaveBeenLastCalledWith({
      id: "00000000-0000-4000-8000-000000000001",
      action: "confirm",
    });
    await user.click(within(first).getByRole("button", { name: "Dismiss" }));
    expect(actions.updateInsight).toHaveBeenLastCalledWith({
      id: "00000000-0000-4000-8000-000000000001",
      action: "dismiss",
    });
    await user.click(within(first).getByRole("button", { name: "Delete “Osmosis”" }));
    expect(actions.deleteInsight).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
  });

  it("corrects an insight with the student's own note", async () => {
    const user = userEvent.setup();
    renderProfile();
    const first = within(memory()).getAllByRole("listitem")[0];
    await user.click(within(first).getByRole("button", { name: "Correct it" }));
    await user.type(within(first).getByLabelText("What’s actually right?"), "I understand osmosis now");
    await user.click(within(first).getByRole("button", { name: "Save correction" }));
    expect(actions.updateInsight).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000001",
      action: "correct",
      note: "I understand osmosis now",
    });
  });

  it("shows a server validation error and keeps the note", async () => {
    actions.updateInsight.mockResolvedValue({
      ok: false,
      error: "invalid",
      message: "Tell your tutor what's actually right.",
    });
    const user = userEvent.setup();
    renderProfile();
    const first = within(memory()).getAllByRole("listitem")[0];
    await user.click(within(first).getByRole("button", { name: "Correct it" }));
    await user.type(within(first).getByLabelText("What’s actually right?"), "no");
    await user.click(within(first).getByRole("button", { name: "Save correction" }));
    expect(await within(first).findByText(/Tell your tutor/)).toBeInTheDocument();
    expect(within(first).getByLabelText("What’s actually right?")).toHaveValue("no");
  });

  it("restores dismissed items from the hidden list", async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(within(memory()).getByRole("button", { name: "Show 1 dismissed" }));
    await user.click(within(memory()).getByRole("button", { name: "Restore" }));
    expect(actions.updateInsight).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000007",
      action: "restore",
    });
  });

  it("clears all learning memory only after confirmation", async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(within(memory()).getByRole("button", { name: "Clear all learning memory" }));
    expect(actions.clearLearningMemory).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Clear everything" }));
    expect(actions.clearLearningMemory).toHaveBeenCalledWith("clear");
  });
});
