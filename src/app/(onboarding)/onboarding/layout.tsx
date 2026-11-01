import type { Metadata } from "next";
import Link from "next/link";
import { AmbientBackdrop } from "@/components/brand/ambient-backdrop";
import { LumioLogo } from "@/components/brand/logo";
import { signOutAction } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Set up your account",
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  return (
    <div className="relative min-h-dvh">
      <AmbientBackdrop intensity="low" />
      <header className="sticky top-0 z-30 border-b border-line/60 bg-ink-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Lumio home" className="rounded-control">
            <LumioLogo />
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="rounded-control px-3 py-2 text-sm text-fg-muted hover:text-fg">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
        {children}
      </main>
    </div>
  );
}
