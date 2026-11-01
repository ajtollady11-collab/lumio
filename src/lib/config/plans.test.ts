import { describe, expect, it } from "vitest";
import { PLANS, formatPrice } from "./plans";

describe("plans", () => {
  it("matches the prices in the product specification", () => {
    const byId = Object.fromEntries(PLANS.map((p) => [p.id, p.monthlyPricePence]));
    expect(byId).toEqual({ free: 0, premium: 2999, family: 4499 });
  });

  it("never advertises unlimited usage", () => {
    for (const plan of PLANS) {
      expect([plan.summary, ...plan.highlights].join(" ").toLowerCase()).not.toContain("unlimited");
    }
  });

  it("formats prices in pounds", () => {
    expect(formatPrice(2999)).toBe("£29.99");
    expect(formatPrice(0)).toBe("£0");
  });
});
