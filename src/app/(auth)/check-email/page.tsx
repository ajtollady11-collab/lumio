import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage({ searchParams }: PageProps<"/check-email">) {
  return (
    <div>
      <div className="mb-8 flex size-12 items-center justify-center rounded-panel bg-blue-500/12 text-blue-400 ring-1 ring-blue-400/25">
        <MailCheck className="size-6" aria-hidden />
      </div>
      <h1 className="text-display-sm sm:text-[2rem]">Check your email</h1>
      <Suspense fallback={<p className="mt-3 h-12 text-fg-muted">We&apos;ve sent you a link.</p>}>
        <Message searchParams={searchParams} />
      </Suspense>
      <p className="mt-6 text-sm text-fg-subtle">
        Nothing after a few minutes? Check your spam folder, or{" "}
        <Link href="/sign-up" className="text-blue-400 hover:text-blue-300">
          try again
        </Link>
        .
      </p>
      <Link href="/sign-in" className="mt-10 inline-block text-sm font-medium text-blue-400 hover:text-blue-300">
        Back to sign in
      </Link>
    </div>
  );
}

async function Message({ searchParams }: { searchParams: PageProps<"/check-email">["searchParams"] }) {
  const params = await searchParams;
  const reason = params.reason === "reset" ? "reset" : "verify";
  const rawEmail = typeof params.email === "string" ? params.email.slice(0, 254) : null;

  return (
    <p className="mt-3 leading-relaxed text-fg-muted">
      {reason === "reset" ? "If an account exists for " : "We've sent a confirmation link to "}
      {rawEmail ? <span className="font-medium text-fg">{rawEmail}</span> : "your email address"}
      {reason === "reset"
        ? ", you'll get a link to choose a new password. It expires in one hour."
        : ". Open it to confirm your account and continue."}
    </p>
  );
}
