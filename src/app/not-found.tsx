import type { Metadata } from "next";
import { AmbientBackdrop } from "@/components/brand/ambient-backdrop";
import { LumioLogo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main id="main" className="relative flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
      <AmbientBackdrop intensity="low" />
      <LumioLogo className="mb-14" />
      <p className="font-display text-[7rem] leading-none font-semibold tracking-[-0.06em] text-fg/10 sm:text-[10rem]">
        404
      </p>
      <h1 className="mt-2 text-display-sm sm:text-display-md">This page isn&apos;t part of the course</h1>
      <p className="mt-4 max-w-md text-fg-muted">
        The link may be out of date, or the page may have moved. Head back and pick up where you left off.
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Go to the home page</ButtonLink>
        <ButtonLink href="/app" variant="secondary">
          Open your dashboard
        </ButtonLink>
      </div>
    </main>
  );
}
