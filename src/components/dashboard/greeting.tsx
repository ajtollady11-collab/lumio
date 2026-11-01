import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { TutorOrb } from "@/components/brand/tutor-orb";
import { Reveal } from "./reveal";

export function Greeting({
  name,
  partOfDay,
  summary,
  consentPending,
  isNew,
}: {
  name: string;
  partOfDay: "morning" | "afternoon" | "evening";
  summary: string | null;
  consentPending: boolean;
  /** No tracked learning yet. */
  isNew: boolean;
}) {
  return (
    <Reveal
      aria-labelledby="greeting-heading"
      className="surface relative isolate flex h-full flex-col justify-center overflow-hidden rounded-stage p-6 sm:p-8"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_85%_40%,rgb(59_123_255/0.20),transparent_55%),radial-gradient(ellipse_at_60%_120%,rgb(138_107_255/0.14),transparent_55%)]"
      />
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-blue-400">Good {partOfDay}</p>
          <h1
            id="greeting-heading"
            className="mt-1.5 truncate font-display text-[2rem] leading-tight font-semibold tracking-[-0.03em] sm:text-display-md"
          >
            {name}
          </h1>
          <p className="mt-3 max-w-xl text-[1.0625rem] leading-relaxed text-fg-muted">
            {summary ?? "Ready to make some progress today?"}
          </p>
          {isNew && !consentPending && (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-fg-subtle">
              Your stats, streak and goals fill in from real lessons and quizzes as they arrive — nothing here is
              estimated.
            </p>
          )}
          {consentPending && (
            <p className="mt-4 flex max-w-xl items-start gap-2 text-sm leading-relaxed text-warning">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                A parent or carer needs to link their account before your tutor starts teaching.{" "}
                <Link href="/app/settings#family" className="underline underline-offset-2">
                  How linking works
                </Link>
              </span>
            </p>
          )}
        </div>
        <TutorOrb state="idle" size={104} label="Your tutor" className="hidden shrink-0 sm:block" />
      </div>
    </Reveal>
  );
}
