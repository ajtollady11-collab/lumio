import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { isBreachedPassword, localPasswordProblem, passwordProblem } from "./password-check";

function rangeResponse(password: string, count: number) {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  return { prefix: hash.slice(0, 5), body: `0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${hash.slice(5)}:${count}\r\n` };
}

describe("localPasswordProblem", () => {
  it("rejects common passwords and simple patterns", () => {
    expect(localPasswordProblem("password123")).toBe("common");
    expect(localPasswordProblem("Pass-Word123")).toBe("common");
    expect(localPasswordProblem("aaaaaaaaaaaa")).toBe("common");
    expect(localPasswordProblem("1234567890abc")).toBe("common");
  });

  it("rejects passwords containing the user's name or email", () => {
    expect(localPasswordProblem("ilovealfie2027", ["Alfie"])).toBe("contains_personal");
  });

  it("accepts an ordinary passphrase", () => {
    expect(localPasswordProblem("purple kettle orbit", ["Alfie", "ajt"])).toBeNull();
  });
});

describe("isBreachedPassword", () => {
  it("sends only the 5-character hash prefix and finds a match", async () => {
    const { prefix, body } = rangeResponse("correct horse", 42);
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe(`https://api.pwnedpasswords.com/range/${prefix}`);
      return new Response(body, { status: 200 });
    });
    await expect(isBreachedPassword("correct horse", fetcher as typeof fetch)).resolves.toBe(true);
    expect(String(fetcher.mock.calls[0][0])).not.toContain("correct");
  });

  it("ignores padding entries with a zero count", async () => {
    const { body } = rangeResponse("padded only", 0);
    const fetcher = vi.fn(async () => new Response(body, { status: 200 }));
    await expect(isBreachedPassword("padded only", fetcher as typeof fetch)).resolves.toBe(false);
  });

  it("fails open when the service is unreachable", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(isBreachedPassword("anything at all", fetcher as typeof fetch)).resolves.toBeNull();
    await expect(passwordProblem("purple kettle orbit", [], fetcher as typeof fetch)).resolves.toBeNull();
  });
});
