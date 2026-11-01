import { describe, expect, it } from "vitest";
import { fromDatabaseError } from "./errors";

describe("fromDatabaseError", () => {
  it("maps database rule keys to friendly messages", () => {
    const f = fromDatabaseError({ code: "P0001", message: "LUMIO:invalid_grade" });
    expect(f.error).toBe("invalid");
    expect(f.message).toMatch(/scale/);
    expect(fromDatabaseError({ message: "LUMIO:incomplete:subjects" }).message).toMatch(/subject/);
  });

  it("maps constraint violations", () => {
    expect(fromDatabaseError({ code: "23505", message: "duplicate key" }).error).toBe("duplicate");
    expect(fromDatabaseError({ code: "23503", message: "fk" }).error).toBe("invalid");
    expect(fromDatabaseError({ code: "42501", message: "rls" }).error).toBe("forbidden");
  });

  it("treats network failures and 5xx as temporary unavailability", () => {
    expect(fromDatabaseError({ message: "TypeError: fetch failed" }).error).toBe("unavailable");
    expect(fromDatabaseError({ message: "upstream", status: 503 }).error).toBe("unavailable");
  });

  it("never exposes raw database text", () => {
    const f = fromDatabaseError({ code: "XX000", message: "internal: relation secret_table does not exist" });
    expect(f.error).toBe("unknown");
    expect(f.message).not.toMatch(/secret_table/);
  });
});
