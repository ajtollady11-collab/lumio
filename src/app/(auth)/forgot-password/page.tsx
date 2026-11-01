import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading, AuthUnavailableNotice } from "@/components/auth/auth-heading";
import { ForgotPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading title="Reset your password">
        Enter the email you signed up with and we&apos;ll send you a link to choose a new password.
      </AuthHeading>
      <AuthUnavailableNotice />
      <ForgotPasswordForm />
      <p className="mt-8 text-sm text-fg-muted">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-medium text-blue-400 hover:text-blue-300">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
