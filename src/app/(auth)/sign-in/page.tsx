import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeading, AuthUnavailableNotice } from "@/components/auth/auth-heading";
import { SignInForm } from "@/components/auth/forms";
import { GoogleSignIn } from "@/components/auth/google-button";
import { FormSkeleton } from "@/components/feedback/skeletons";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <>
      <AuthHeading title="Welcome back">Sign in to continue learning.</AuthHeading>
      <AuthUnavailableNotice />
      <GoogleSignIn />
      <Suspense fallback={<FormSkeleton fields={2} />}>
        <SignInForm searchParams={searchParams} />
      </Suspense>
      <p className="mt-8 text-sm text-fg-muted">
        New to Lumio?{" "}
        <Link href="/sign-up" className="font-medium text-blue-400 hover:text-blue-300">
          Create an account
        </Link>
      </p>
    </>
  );
}
