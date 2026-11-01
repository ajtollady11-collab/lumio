"use server";

import { redirect } from "next/navigation";
import { getSupabasePublicConfig, publicEnv } from "@/lib/config/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";
import {
  flattenFieldErrors,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type FieldErrors,
} from "./schemas";

export type AuthFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
  /** Echo non-secret inputs back so a failed submit doesn't wipe the form. */
  values?: Record<string, string>;
};

const NOT_CONFIGURED: AuthFormState = {
  status: "error",
  message: "Accounts aren't available yet — authentication hasn't been connected to this environment.",
};

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function absolute(path: string): string {
  return new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL).toString();
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!getSupabasePublicConfig()) return NOT_CONFIGURED;

  const values = { email: str(formData, "email") };
  const parsed = signInSchema.safeParse({ email: values.email, password: str(formData, "password") });
  if (!parsed.success) return { status: "error", fieldErrors: flattenFieldErrors(parsed.error), values };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { status: "error", message: "Confirm your email first — check your inbox for the link we sent.", values };
    }
    if (error.status === 429) {
      return { status: "error", message: "Too many attempts. Wait a minute, then try again.", values };
    }
    // Same message for unknown email and wrong password: no account enumeration.
    return { status: "error", message: "That email and password don't match an account.", values };
  }

  redirect(safeRedirectPath(str(formData, "next")));
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!getSupabasePublicConfig()) return NOT_CONFIGURED;

  const values = {
    firstName: str(formData, "firstName"),
    email: str(formData, "email"),
    accountRole: str(formData, "accountRole"),
  };
  const parsed = signUpSchema.safeParse({ ...values, password: str(formData, "password") });
  if (!parsed.success) return { status: "error", fieldErrors: flattenFieldErrors(parsed.error), values };

  const { firstName, email, password, accountRole } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: absolute("/auth/confirm?next=/app"),
      // Read by the on_auth_user_created trigger, which validates the role.
      data: { first_name: firstName, account_role: accountRole },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: "Choose a less common password." }, values };
    }
    if (error.status === 429) {
      return { status: "error", message: "Too many sign-up attempts. Wait a few minutes, then try again.", values };
    }
    return { status: "error", message: "We couldn't create your account. Try again in a moment.", values };
  }

  // Supabase returns success for an existing email too (no enumeration), so
  // every successful submit lands on the same page.
  redirect(`/check-email?reason=verify&email=${encodeURIComponent(email)}`);
}

export async function requestPasswordResetAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!getSupabasePublicConfig()) return NOT_CONFIGURED;

  const values = { email: str(formData, "email") };
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: flattenFieldErrors(parsed.error), values };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: absolute("/auth/confirm?next=/reset-password"),
  });

  if (error?.status === 429) {
    return { status: "error", message: "Too many requests. Wait a few minutes, then try again.", values };
  }
  // Any other outcome shows the same confirmation, whether or not the account exists.
  redirect(`/check-email?reason=reset&email=${encodeURIComponent(parsed.data.email)}`);
}

export async function updatePasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!getSupabasePublicConfig()) return NOT_CONFIGURED;

  const parsed = resetPasswordSchema.safeParse({
    password: str(formData, "password"),
    confirmPassword: str(formData, "confirmPassword"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: flattenFieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return { status: "error", message: "Your reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { status: "error", fieldErrors: { password: "Choose a password you haven't used before." } };
    }
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: "Choose a less common password." } };
    }
    return { status: "error", message: "We couldn't update your password. Request a new reset link." };
  }

  redirect("/app");
}

export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  if (!getSupabasePublicConfig() || !publicEnv.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED) redirect("/sign-in");

  const next = safeRedirectPath(str(formData, "next"));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: absolute(`/auth/confirm?next=${encodeURIComponent(next)}`) },
  });
  if (error || !data.url) redirect("/sign-in?error=oauth");
  redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  if (getSupabasePublicConfig()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/sign-in");
}
