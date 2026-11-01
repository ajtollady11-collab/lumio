"use client";

import Link from "next/link";
import { use, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
  type AuthFormState,
} from "@/lib/auth/actions";
import { cn } from "@/lib/utils/cn";

const initial: AuthFormState = { status: "idle" };

type Params = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const LINK_ERRORS: Record<string, string> = {
  link_expired: "That link has expired or was already used. Sign in, or request a new link.",
  invalid_link: "That link isn't valid. Sign in, or request a new link.",
  oauth: "Google sign-in didn't complete. Try again, or use your email and password.",
  unavailable: "Accounts aren't open in this environment yet.",
};

export function SignInForm({ searchParams }: { searchParams: Params }) {
  const params = use(searchParams);
  const next = first(params.next) ?? "";
  const linkError = LINK_ERRORS[first(params.error) ?? ""];
  const [state, action, pending] = useActionState(signInAction, initial);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {linkError && state.status === "idle" && <Notice tone="error">{linkError}</Notice>}
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <input type="hidden" name="next" value={next} />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <div className="flex flex-col gap-2">
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
        />
        <Link href="/forgot-password" className="self-end text-sm text-blue-400 hover:text-blue-300">
          Forgot your password?
        </Link>
      </div>
      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        Sign in
      </Button>
    </form>
  );
}

const ROLES = [
  { value: "student", title: "I'm a student", body: "Get your own tutor and lessons." },
  { value: "parent", title: "I'm a parent", body: "Follow your child's progress." },
] as const;

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initial);
  const role = state.values?.accountRole ?? "student";

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.message && <Notice tone="error">{state.message}</Notice>}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Who is this account for?</legend>
        <div className="grid grid-cols-2 gap-2.5">
          {ROLES.map((r) => (
            <label
              key={r.value}
              className={cn(
                "group relative flex cursor-pointer flex-col gap-1 rounded-control border border-line-strong bg-ink-900/60 p-3.5",
                "transition-colors has-[:checked]:border-blue-400/70 has-[:checked]:bg-blue-500/10",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cyan-400",
              )}
            >
              <input
                type="radio"
                name="accountRole"
                value={r.value}
                defaultChecked={role === r.value}
                className="sr-only"
              />
              <span className="text-[0.9375rem] font-medium">{r.title}</span>
              <span className="text-[0.8125rem] leading-snug text-fg-subtle">{r.body}</span>
            </label>
          ))}
        </div>
        {state.fieldErrors?.accountRole && (
          <p className="mt-2 text-[0.8125rem] text-danger">{state.fieldErrors.accountRole}</p>
        )}
      </fieldset>

      <TextField
        label="First name"
        name="firstName"
        autoComplete="given-name"
        required
        maxLength={40}
        defaultValue={state.values?.firstName}
        error={state.fieldErrors?.firstName}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        required
        hint="At least 10 characters. A short phrase is easier to remember."
        error={state.fieldErrors?.password}
      />
      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        Create account
      </Button>
      <p className="text-[0.8125rem] leading-relaxed text-fg-subtle">
        If you&apos;re under 13, a parent or carer will need to give permission before you can start lessons.
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initial);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, initial);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        required
        hint="At least 10 characters."
        error={state.fieldErrors?.password}
      />
      <PasswordField
        label="Confirm new password"
        name="confirmPassword"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Save new password
      </Button>
    </form>
  );
}
