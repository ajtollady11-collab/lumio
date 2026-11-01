import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address.")
  .max(254, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."));

/** NCSC-aligned: length over complexity rules. 10–72 chars (bcrypt limit). */
export const passwordSchema = z.string().min(10, "Use at least 10 characters.").max(72, "Use 72 characters or fewer.");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(72),
});

export const signUpSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Enter your first name.")
    .max(40, "Use 40 characters or fewer.")
    .regex(/^[\p{L}\p{M}' -]+$/u, "Use letters, spaces, hyphens or apostrophes."),
  email,
  password: passwordSchema,
  accountRole: z.enum(["student", "parent"], { error: "Choose who the account is for." }),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords don't match.",
  });

export type FieldErrors = Partial<Record<string, string>>;

/** First error message per field — the shape forms render. */
export function flattenFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
