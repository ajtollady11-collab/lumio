import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading, AuthUnavailableNotice } from "@/components/auth/auth-heading";
import { SignUpForm } from "@/components/auth/forms";
import { GoogleSignIn } from "@/components/auth/google-button";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <>
      <AuthHeading title="Create your account">
        It takes a minute. You&apos;ll set up your tutor and subjects next.
      </AuthHeading>
      <AuthUnavailableNotice />
      <GoogleSignIn />
      <SignUpForm />
      <p className="mt-8 text-sm text-fg-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-blue-400 hover:text-blue-300">
          Sign in
        </Link>
      </p>
    </>
  );
}
