import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps same-origin relative paths, including query and hash", () => {
    expect(safeRedirectPath("/app/lessons?topic=cells#plan")).toBe("/app/lessons?topic=cells#plan");
  });

  it.each([
    ["https://evil.example/phish"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["javascript:alert(1)"],
    ["app"],
    ["/\u0000/evil"],
    ["/\n/evil"],
  ])("rejects %j", (input) => {
    expect(safeRedirectPath(input)).toBe("/app");
  });

  it("uses the fallback for empty input", () => {
    expect(safeRedirectPath(null)).toBe("/app");
    expect(safeRedirectPath(undefined, "/parent")).toBe("/parent");
    expect(safeRedirectPath("")).toBe("/app");
  });
});
