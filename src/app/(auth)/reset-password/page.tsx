import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ResetPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <AuthHeading title="Choose a new password">You&apos;ll stay signed in on this device afterwards.</AuthHeading>
      <ResetPasswordForm />
    </>
  );
}
