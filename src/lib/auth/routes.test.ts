import { describe, expect, it } from "vitest";
import { isAuthPage, isProtectedPath } from "./routes";

describe("isProtectedPath", () => {
  it.each(["/app", "/app/tutor", "/parent", "/parent/reports", "/admin", "/admin/costs", "/onboarding"])(
    "protects %s",
    (p) => {
      expect(isProtectedPath(p)).toBe(true);
    },
  );

  it.each(["/", "/sign-in", "/application", "/parents-guide", "/api/health"])("leaves %s public", (p) => {
    expect(isProtectedPath(p)).toBe(false);
  });
});

describe("isAuthPage", () => {
  it("matches the sign-in family exactly", () => {
    expect(isAuthPage("/sign-in")).toBe(true);
    expect(isAuthPage("/sign-in/extra")).toBe(false);
    expect(isAuthPage("/reset-password")).toBe(false);
  });
});
