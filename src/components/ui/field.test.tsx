import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PasswordField, TextField } from "./field";

describe("TextField", () => {
  it("associates label, hint and error with the input", () => {
    const { rerender } = render(<TextField label="Email" name="email" hint="We never share it." />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAccessibleDescription("We never share it.");

    rerender(<TextField label="Email" name="email" hint="We never share it." error="Enter a valid email address." />);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a valid email address.");
  });
});

describe("PasswordField", () => {
  it("toggles visibility with an accessible control", async () => {
    render(<PasswordField label="Password" name="password" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  });
});
