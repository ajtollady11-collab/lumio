import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REF, activeActivity, emptyActivity, profile } from "@/test/dashboard-fixtures";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn(), push: vi.fn() }) }));
const actions = vi.hoisted(() => ({ saveWeeklyGoals: vi.fn(), clearWeeklyGoals: vi.fn() }));
vi.mock("@/server/dashboard/actions", () => actions);

const { StudentDashboard } = await import("./student-dashboard");

// 16:00 London on the fixture's Wednesday.
const NOW = new Date("2026-11-04T16:00:00Z");

type Props = Parameters<typeof StudentDashboard>[0];
function renderDashboard(overrides: Partial<Props> = {}) {
  return render(
    <StudentDashboard
      displayName="fallback"
      profile={profile()}
      reference={REF}
      activity={emptyActivity()}
      now={NOW}
      {...overrides}
    />,
  );
}
const section = (name: RegExp | string) => screen.getByRole("region", { name });

beforeEach(() => {
  actions.saveWeeklyGoals.mockReset().mockResolvedValue({ ok: true, data: null });
  actions.clearWeeklyGoals.mockReset().mockResolvedValue({ ok: true, data: null });
  refresh.mockReset();
});

describe("StudentDashboard — new student (no activity, no goals)", () => {
  it("greets by name with the time of day and a factual summary", () => {
    renderDashboard();
    const hero = section("Alex");
    expect(within(hero).getByText("Good afternoon")).toBeInTheDocument();
    expect(within(hero).getByText("Your Chemistry exam is in 8 days.")).toBeInTheDocument();
    expect(within(hero).getByText(/nothing here is estimated/)).toBeInTheDocument();
  });

  it("shows empty states instead of invented numbers", () => {
    renderDashboard();
    const overview = section("Learning overview");
    expect(within(overview).getByText("Starts with your first lesson")).toBeInTheDocument();
    expect(within(overview).getByText("Tracked once lessons begin")).toBeInTheDocument();
    expect(within(overview).getByText("No quizzes yet")).toBeInTheDocument();
    // The only figure is the subject count, which comes from the profile.
    expect(within(overview).getByText("3")).toBeInTheDocument();
    expect(within(overview).queryByText(/%/)).not.toBeInTheDocument();

    expect(within(section("Recent activity")).getByText("Nothing here yet")).toBeInTheDocument();
    expect(within(section("Study streak")).getByText(/Opening the app doesn't/)).toBeInTheDocument();
    const cards = within(section("Your subjects"))
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href")?.startsWith("/app/subjects/"));
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card).toHaveTextContent("Not assessed yet");
      expect(card).toHaveTextContent("Not studied yet");
    }
  });

  it("lists every subject with its board, qualification and target", () => {
    renderDashboard();
    const subjects = section("Your subjects");
    const bio = within(subjects).getByRole("link", { name: /Biology/ });
    expect(bio).toHaveAttribute("href", "/app/subjects/biology");
    expect(bio).toHaveTextContent("A-level · AQA");
    expect(bio).toHaveTextContent("Target A*");
    expect(within(subjects).getByRole("link", { name: /Economics/ })).toHaveTextContent("Exam board not set");
  });

  it("orders exams by date, drops past ones and highlights the close one", () => {
    renderDashboard();
    const exams = section("Upcoming exams");
    const items = within(exams).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^8days.*Chemistry.*Paper 1.*A-level · OCR/),
      expect.stringMatching(/^216days.*Biology/),
    ]);
    expect(within(items[0]).getByRole("link")).toHaveAttribute("href", "/app/subjects/chemistry#exams");
    expect(exams.className).toMatch(/ring-cyan/);
  });

  it("gives recommendations with a reason, duration and working link", () => {
    renderDashboard();
    const recs = within(section("What to do next")).getAllByRole("link");
    expect(recs[0]).toHaveTextContent("Revise Chemistry for your exam");
    expect(recs[0]).toHaveTextContent("30 min");
    expect(recs[0]).toHaveAttribute("href", "/app/subjects/chemistry");
    expect(recs.length).toBeLessThanOrEqual(4);
    for (const r of recs) expect(r.getAttribute("href")).toMatch(/^(\/app|#)/);
  });
});

describe("StudentDashboard — quick actions", () => {
  it("links every action and labels unbuilt areas as coming soon", () => {
    renderDashboard();
    const region = section("Quick actions");
    const links = within(region).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/app/lessons",
      "/app/tutor",
      "/app/subjects",
      "/app/revision",
      "/app/progress",
    ]);
    expect(within(region).getAllByText("Soon")).toHaveLength(4);
    expect(within(links[2]).queryByText("Soon")).not.toBeInTheDocument();
  });
});

describe("StudentDashboard — student with activity and goals", () => {
  it("shows tracked figures", () => {
    renderDashboard({ activity: activeActivity(), profile: profile({ exams: [] }) });
    const overview = section("Learning overview");
    expect(within(overview).getByText("4")).toBeInTheDocument(); // lessons
    expect(within(overview).getByText("2 h 10 min")).toBeInTheDocument();
    expect(within(overview).getByText("52%")).toBeInTheDocument();
    expect(within(overview).getByText("3 quizzes")).toBeInTheDocument();
    expect(within(overview).getByText("2 days")).toBeInTheDocument();

    const chem = within(section("Your subjects")).getByRole("link", { name: /Chemistry/ });
    expect(chem).toHaveTextContent("52%avg of 3");
    expect(chem).toHaveTextContent("Studied yesterday");
    expect(within(section("Your subjects")).getByRole("link", { name: /Biology/ })).toHaveTextContent("Studied today");
    expect(within(section("Your subjects")).getByRole("link", { name: /Economics/ })).toHaveTextContent(
      "Studied 15 days ago",
    );
  });

  it("shows the streak and this week's calendar", () => {
    renderDashboard({ activity: activeActivity() });
    const streak = section("Study streak");
    expect(within(streak).getByText("2")).toBeInTheDocument();
    expect(within(streak).getByText("5")).toBeInTheDocument();
    expect(within(streak).getByText(/Tuesday 3 November: studied/)).toBeInTheDocument();
    expect(within(streak).getByText(/Thursday 5 November: upcoming/)).toBeInTheDocument();
    expect(within(streak).getByText(/Today counts/)).toBeInTheDocument();
  });

  it("measures goals against tracked activity only", () => {
    renderDashboard({ activity: activeActivity() });
    const goals = section("Weekly goals");
    expect(within(goals).getByRole("progressbar", { name: "Study time: 60 of 240" })).toBeInTheDocument();
    expect(within(goals).getByRole("progressbar", { name: "Lessons: 2 of 3" })).toBeInTheDocument();
    expect(within(goals).queryByText("Subjects covered")).not.toBeInTheDocument();
  });

  it("lists recent activity with subject, time, duration and result", () => {
    renderDashboard({ activity: activeActivity() });
    const items = within(section("Recent activity")).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Lesson · Biology: Cell structure");
    expect(items[0]).toHaveTextContent("Today, 16:30 · 25 min");
    expect(items[0]).toHaveTextContent("Completed");
    expect(items[1]).toHaveTextContent("Quiz · Chemistry: Bonding");
    expect(items[1]).toHaveTextContent("Yesterday, 18:10 · 10 min");
    expect(items[1]).toHaveTextContent("45%");
  });

  it("recommends the weak subject from real quiz scores", () => {
    renderDashboard({ activity: activeActivity(), profile: profile({ exams: [] }) });
    expect(within(section("What to do next")).getByText(/Chemistry average is 52% across 3/)).toBeInTheDocument();
  });

  it("encourages a lapsed student to resume", () => {
    const lapsed = emptyActivity({
      totals: { ...emptyActivity().totals, events: 4, lastActiveDate: "2026-10-28", lessonsCompleted: 2 },
    });
    renderDashboard({ activity: lapsed, profile: profile({ exams: [] }) });
    expect(within(section("Alex")).getByText(/It's been 7 days since your last study session/)).toBeInTheDocument();
    expect(within(section("What to do next")).getByText("Pick up where you left off")).toBeInTheDocument();
  });
});

describe("StudentDashboard — edge cases", () => {
  it("handles a student with no subjects and no exams", () => {
    renderDashboard({ profile: profile({ subjects: [], exams: [] }) });
    expect(within(section("Your subjects")).getByText("No subjects yet")).toBeInTheDocument();
    expect(within(section("Your subjects")).getByRole("link", { name: "Choose subjects" })).toHaveAttribute(
      "href",
      "/app/settings#studies",
    );
    expect(within(section("Upcoming exams")).getByRole("link", { name: "Add exam dates" })).toHaveAttribute(
      "href",
      "/app/settings#exams",
    );
    expect(within(section("Alex")).getByText("Ready to make some progress today?")).toBeInTheDocument();
  });

  it("explains parental linking to under-13s", () => {
    renderDashboard({ profile: profile({ parentalConsent: "pending" }) });
    expect(within(section("Alex")).getByText(/parent or carer needs to link/)).toBeInTheDocument();
    expect(within(section("What to do next")).getAllByRole("link")[0]).toHaveTextContent("Ask a parent or carer");
  });
});

describe("Weekly goals editor", () => {
  it("creates goals", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(within(section("Weekly goals")).getByRole("button", { name: "Set weekly goals" }));
    const dialog = await screen.findByRole("dialog", { name: "Weekly goals" });
    await user.type(within(dialog).getByLabelText(/Study time/), "300");
    await user.type(within(dialog).getByLabelText(/Lessons/), "3");
    await user.click(within(dialog).getByRole("button", { name: "Save goals" }));
    expect(actions.saveWeeklyGoals).toHaveBeenCalledWith({
      weeklyMinutes: "300",
      weeklyLessons: "3",
      weeklySubjects: "",
      weeklyRevisionSessions: "",
    });
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows the server's field error and keeps the input", async () => {
    const user = userEvent.setup();
    actions.saveWeeklyGoals.mockResolvedValueOnce({
      ok: false,
      error: "invalid",
      message: "Study time: at least 15.",
      fieldErrors: { weeklyMinutes: "Study time: at least 15." },
    });
    renderDashboard();
    await user.click(within(section("Weekly goals")).getByRole("button", { name: "Set weekly goals" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Study time/), "5");
    await user.click(within(dialog).getByRole("button", { name: "Save goals" }));
    expect(await within(dialog).findByText("Study time: at least 15.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Study time/)).toHaveValue(5);
  });

  it("edits and removes existing goals", async () => {
    const user = userEvent.setup();
    renderDashboard({ activity: activeActivity() });
    await user.click(within(section("Weekly goals")).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/Study time/)).toHaveValue(240);
    await user.click(within(dialog).getByRole("button", { name: "Remove goals" }));
    expect(actions.clearWeeklyGoals).toHaveBeenCalled();
  });
});
