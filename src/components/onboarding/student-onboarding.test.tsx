import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReferenceData } from "@/server/curriculum/reference";
import type { StudentSnapshot } from "@/server/onboarding/student-data";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn() }) }));

const actions = vi.hoisted(() => ({
  saveAbout: vi.fn(),
  saveQualification: vi.fn(),
  saveSubjects: vi.fn(),
  saveBoards: vi.fn(),
  saveGoals: vi.fn(),
  saveExam: vi.fn(),
  removeExam: vi.fn(),
  savePreferences: vi.fn(),
  recordStep: vi.fn(),
  completeStudentOnboarding: vi.fn(),
}));
vi.mock("@/server/onboarding/student-actions", () => actions);

const { StudentOnboarding } = await import("./student-onboarding");

const Q = { gcse: "q-gcse", igcse: "q-igcse", as: "q-as", a: "q-a" };
const B = { aqa: "b-aqa", edexcel: "b-edexcel", ocr: "b-ocr", wjec: "b-wjec" };
const reference: ReferenceData = {
  qualifications: [
    { id: Q.gcse, slug: "gcse", name: "GCSE", level: "gcse" },
    { id: Q.igcse, slug: "international-gcse", name: "International GCSE", level: "igcse" },
    { id: Q.as, slug: "as-level", name: "AS level", level: "as_level" },
    { id: Q.a, slug: "a-level", name: "A-level", level: "a_level" },
  ],
  examBoards: [
    { id: B.aqa, slug: "aqa", name: "AQA" },
    { id: B.edexcel, slug: "pearson-edexcel", name: "Pearson Edexcel" },
    { id: B.ocr, slug: "ocr", name: "OCR" },
    { id: B.wjec, slug: "wjec", name: "WJEC" },
  ],
  subjects: [
    { id: "s-bio", slug: "biology", name: "Biology" },
    { id: "s-econ", slug: "economics", name: "Economics" },
    { id: "s-phys", slug: "physics", name: "Physics" },
  ],
  boardsByQualification: {
    [Q.gcse]: [B.aqa, B.edexcel, B.ocr, B.wjec],
    [Q.as]: [B.aqa, B.edexcel, B.ocr, B.wjec],
    [Q.a]: [B.aqa, B.edexcel, B.ocr, B.wjec],
    [Q.igcse]: [B.edexcel],
  },
};

const blank: StudentSnapshot = {
  profile: {
    firstName: "Alfie",
    ageBand: null,
    schoolYear: null,
    educationLevel: null,
    primaryQualificationId: null,
    academicGoals: null,
    learningPreferences: [],
    onboardingStep: 1,
    parentalConsent: "not_required",
  },
  subjects: [],
  exams: [],
};

const ok = { ok: true as const, data: null };

beforeEach(() => {
  Object.values(actions).forEach((fn) => fn.mockReset().mockResolvedValue(ok));
  replace.mockReset();
});

describe("StudentOnboarding", () => {
  it("walks every step, saving each one, and finishes on the dashboard", async () => {
    const user = userEvent.setup();
    render(<StudentOnboarding initialStep={1} snapshot={blank} reference={reference} today="2026-11-01" />);

    // 1 · About you (first name prefilled from sign-up)
    expect(screen.getByLabelText("First name")).toHaveValue("Alfie");
    await user.click(screen.getByLabelText("16–17"));
    await user.click(screen.getByLabelText("Year 12"));
    await user.click(screen.getByRole("radio", { name: /^A-level/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(actions.saveAbout).toHaveBeenCalledWith(
      { firstName: "Alfie", ageBand: "16_17", schoolYear: 12, educationLevel: "a_level" },
      { advanceTo: 2 },
    );

    // 2 · Qualification — A-level suggested from the level chosen
    await screen.findByRole("heading", { name: "Which qualification?" });
    expect(screen.getByRole("radio", { name: /A-level.*Suggested/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(actions.saveQualification).toHaveBeenCalledWith({ qualificationId: Q.a }, { advanceTo: 3 });

    // 3 · Subjects — Continue disabled until one is chosen
    await screen.findByRole("heading", { name: "Pick your subjects" });
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Biology" }));
    await user.click(screen.getByRole("checkbox", { name: "Economics" }));
    await user.type(screen.getByLabelText("Search subjects"), "phys");
    expect(screen.queryByRole("checkbox", { name: "Biology" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(actions.saveSubjects).toHaveBeenCalledWith({ subjectIds: ["s-bio", "s-econ"] }, { advanceTo: 4 });

    // 4 · Exam boards — a different board per subject
    await screen.findByRole("heading", { name: "Which exam boards?" });
    const bio = screen.getByRole("group", { name: "Exam board for Biology" });
    const econ = screen.getByRole("group", { name: "Exam board for Economics" });
    await user.click(within(bio).getByLabelText("AQA"));
    await user.click(within(econ).getByLabelText("Pearson Edexcel"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(actions.saveBoards).toHaveBeenCalledWith(
      {
        entries: [
          { subjectId: "s-bio", qualificationId: Q.a, examBoardId: B.aqa },
          { subjectId: "s-econ", qualificationId: Q.a, examBoardId: B.edexcel },
        ],
      },
      { advanceTo: 5 },
    );

    // 5 · Goals — optional, A-level grade scale offered
    await screen.findByRole("heading", { name: /Where you are/ });
    const targets = screen.getAllByLabelText(/Target grade/);
    expect(within(targets[0]).getByRole("option", { name: "A*" })).toBeInTheDocument();
    await user.selectOptions(targets[0], "A*");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(actions.saveGoals.mock.calls[0][0].entries[0]).toMatchObject({ subjectId: "s-bio", targetGrade: "A*" });

    // 6 · Exams — skippable
    await screen.findByRole("heading", { name: "When are your exams?" });
    await user.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(actions.recordStep).toHaveBeenCalledWith(7);

    // 7 · Preferences — at least one required
    await screen.findByRole("heading", { name: "How do you like to learn?" });
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Visual explanations/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(actions.savePreferences).toHaveBeenCalledWith({ preferences: ["visual"] }, { advanceTo: 8 });

    // 8 · Summary reflects what was saved
    await screen.findByRole("heading", { name: "You're all set, Alfie" });
    expect(screen.getByText("Biology")).toBeInTheDocument();
    expect(screen.getByText(/A-level, AQA/)).toBeInTheDocument();
    expect(screen.getByText("Target A*")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to my dashboard" }));
    expect(actions.completeStudentOnboarding).toHaveBeenCalled();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app"));
  });

  it("keeps answers and offers a retry when saving fails", async () => {
    const user = userEvent.setup();
    actions.saveAbout.mockResolvedValueOnce({
      ok: false,
      error: "unavailable",
      message: "We couldn't reach Lumio's servers just now. Your answers are still here — try again in a moment.",
    });
    render(<StudentOnboarding initialStep={1} snapshot={blank} reference={reference} today="2026-11-01" />);

    await user.click(screen.getByLabelText("13–15"));
    await user.click(screen.getByLabelText("Year 10"));
    await user.click(screen.getByRole("radio", { name: /^GCSE/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't reach Lumio's servers");
    expect(screen.getByLabelText("13–15")).toBeChecked();
    expect(screen.getByRole("heading", { name: "Let's start with you" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Which qualification?" });
    expect(actions.saveAbout).toHaveBeenCalledTimes(2);
  });

  it("shows server field errors next to the right field", async () => {
    const user = userEvent.setup();
    actions.saveAbout.mockResolvedValueOnce({
      ok: false,
      error: "invalid",
      message: "Choose your age.",
      fieldErrors: { ageBand: "Choose your age." },
    });
    render(<StudentOnboarding initialStep={1} snapshot={blank} reference={reference} today="2026-11-01" />);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findAllByText("Choose your age.")).not.toHaveLength(0);
  });

  it("explains the parental-consent step for under-13s", async () => {
    const user = userEvent.setup();
    render(<StudentOnboarding initialStep={1} snapshot={blank} reference={reference} today="2026-11-01" />);
    await user.click(screen.getByLabelText("Under 13"));
    expect(screen.getByText(/parent or carer will need to link/)).toBeInTheDocument();
  });

  it("only offers boards that run the chosen qualification", async () => {
    const snapshot: StudentSnapshot = {
      ...blank,
      profile: {
        ...blank.profile,
        ageBand: "16_17",
        schoolYear: 11,
        educationLevel: "igcse",
        primaryQualificationId: Q.igcse,
        onboardingStep: 4,
      },
      subjects: [
        {
          id: "r1",
          subjectId: "s-phys",
          qualificationId: Q.igcse,
          examBoardId: null,
          currentGrade: null,
          targetGrade: null,
          confidence: null,
        },
      ],
    };
    render(<StudentOnboarding initialStep={4} snapshot={snapshot} reference={reference} today="2026-11-01" />);
    const group = screen.getByRole("group", { name: "Exam board for Physics" });
    expect(within(group).queryByLabelText("AQA")).not.toBeInTheDocument();
    expect(within(group).getByLabelText("Pearson Edexcel")).toBeInTheDocument();
    expect(within(group).getByLabelText("Not sure yet")).toBeChecked();
  });
});
