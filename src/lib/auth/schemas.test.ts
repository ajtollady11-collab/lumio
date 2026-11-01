import { describe, expect, it } from "vitest";
import { flattenFieldErrors, resetPasswordSchema, signUpSchema } from "./schemas";

const valid = {
  firstName: "Amara",
  email: "Amara@Example.co.uk ",
  password: "a long passphrase",
  accountRole: "student",
};

describe("signUpSchema", () => {
  it("accepts a valid sign-up and normalises the email", () => {
    const result = signUpSchema.parse(valid);
    expect(result.email).toBe("amara@example.co.uk");
  });

  it("accepts names with accents, hyphens and apostrophes", () => {
    expect(signUpSchema.safeParse({ ...valid, firstName: "Zoë-Anne O'Neill" }).success).toBe(true);
  });

  it("rejects elevated roles", () => {
    const result = signUpSchema.safeParse({ ...valid, accountRole: "admin" });
    expect(result.success).toBe(false);
  });

  it("requires at least 10 password characters", () => {
    const result = signUpSchema.safeParse({ ...valid, password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) expect(flattenFieldErrors(result.error).password).toBe("Use at least 10 characters.");
  });

  it("rejects markup in names", () => {
    expect(signUpSchema.safeParse({ ...valid, firstName: "<script>" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("reports mismatched confirmation on the confirm field", () => {
    const result = resetPasswordSchema.safeParse({ password: "a long passphrase", confirmPassword: "different one" });
    expect(result.success).toBe(false);
    if (!result.success) expect(flattenFieldErrors(result.error).confirmPassword).toBe("The passwords don't match.");
  });
});
