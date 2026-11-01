import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TutorOrb } from "./tutor-orb";

describe("TutorOrb", () => {
  it.each([
    ["idle", "Tutor is ready"],
    ["listening", "Tutor is listening"],
    ["thinking", "Tutor is thinking"],
    ["speaking", "Tutor is speaking"],
  ] as const)("announces the %s state", (state, label) => {
    render(<TutorOrb state={state} />);
    expect(screen.getByRole("img", { name: label })).toBeInTheDocument();
  });

  it("accepts a personalised label", () => {
    render(<TutorOrb state="listening" label="Nova is listening" />);
    expect(screen.getByRole("img", { name: "Nova is listening" })).toBeInTheDocument();
  });
});
