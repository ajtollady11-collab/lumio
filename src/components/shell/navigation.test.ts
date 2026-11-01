import { describe, expect, it } from "vitest";
import { PARENT_NAV, STUDENT_NAV, activeItem, allItems, findBySlug } from "./navigation";

describe("student navigation", () => {
  it("lists the ten areas from the product specification, in order", () => {
    expect(allItems(STUDENT_NAV).map((i) => i.label)).toEqual([
      "Home",
      "My Tutor",
      "Live Lessons",
      "Subjects",
      "Revision Centre",
      "Flashcards",
      "Exam Practice",
      "My Notes",
      "Progress",
      "Settings",
    ]);
  });

  it("has unique keys and hrefs", () => {
    const items = allItems(STUDENT_NAV);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
    expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
  });

  it("puts exactly four items in the phone tab bar (plus More)", () => {
    expect(allItems(STUDENT_NAV).filter((i) => i.primaryOnMobile)).toHaveLength(4);
    expect(allItems(PARENT_NAV).filter((i) => i.primaryOnMobile).length).toBeLessThanOrEqual(4);
  });
});

describe("activeItem", () => {
  it("matches home only exactly", () => {
    expect(activeItem(STUDENT_NAV, "/app")?.key).toBe("home");
    expect(activeItem(STUDENT_NAV, "/app/unknown")).toBeUndefined();
  });

  it("matches nested routes by prefix", () => {
    expect(activeItem(STUDENT_NAV, "/app/lessons/123")?.key).toBe("lessons");
    expect(activeItem(PARENT_NAV, "/parent/reports/2026-10-26")?.key).toBe("reports");
  });
});

describe("findBySlug", () => {
  it("resolves area slugs", () => {
    expect(findBySlug(STUDENT_NAV, "exam-practice")?.label).toBe("Exam Practice");
    expect(findBySlug(STUDENT_NAV, "nope")).toBeUndefined();
  });
});
