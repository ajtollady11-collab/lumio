import { ArrowUpRight, BookOpen, CalendarClock } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { SubjectSummary } from "@/lib/dashboard/model";
import { daysUntil } from "@/lib/onboarding/dates";
import { cn } from "@/lib/utils/cn";

export function lastStudiedLabel(s: Pick<SubjectSummary, "lastStudiedDate">, today: string): string {
  if (!s.lastStudiedDate) return "Not studied yet";
  // daysUntil(a, b) = a − b in days, so this is how long ago it was.
  const ago = daysUntil(today, s.lastStudiedDate);
  if (ago <= 0) return "Studied today";
  if (ago === 1) return "Studied yesterday";
  return `Studied ${ago} days ago`;
}

/**
 * One subject. Every figure is either from onboarding (grades, board) or
 * from tracked activity; anything without data says so plainly.
 */
export type TopicCounts = { tracked: number; assessed: number; strong: number; toImprove: number };

/** "3 tracked" + "1 strong · 1 to improve" — counts of mastery rows, never a percentage. */
export function topicSummary(t: TopicCounts | undefined): { main: string; sub: string | null } {
  if (!t) return { main: "Tracked from lessons", sub: null };
  if (t.tracked === 0) return { main: "None yet", sub: null };
  const parts = [t.strong ? `${t.strong} strong` : null, t.toImprove ? `${t.toImprove} to improve` : null].filter(
    Boolean,
  );
  return { main: `${t.tracked} tracked`, sub: parts.length ? parts.join(" · ") : `${t.assessed} assessed` };
}

export function SubjectCard({
  subject: s,
  today,
  topics,
}: {
  subject: SubjectSummary;
  today: string;
  topics?: TopicCounts;
}) {
  const topicText = topicSummary(topics);
  return (
    <Link
      href={`/app/subjects/${s.slug}`}
      style={{ "--accent": s.accent.hex, "--accent-soft": s.accent.soft } as CSSProperties}
      className="group relative flex h-full flex-col overflow-hidden rounded-panel border border-line bg-ink-900/45 p-5 transition-[border-color,transform,box-shadow] duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] hover:shadow-[0_18px_40px_-24px_var(--accent)]"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[var(--accent)] via-[var(--accent)]/40 to-transparent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 size-40 rounded-full opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "var(--accent-soft)" }}
      />

      <span className="relative flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate font-display text-lg font-semibold tracking-tight">{s.name}</span>
          <span className="mt-0.5 block truncate text-sm text-fg-muted">
            {s.qualificationName}
            {s.boardName ? ` · ${s.boardName}` : ""}
          </span>
          {!s.boardName && <span className="mt-0.5 block text-[0.8125rem] text-warning/90">Exam board not set</span>}
        </span>
        <ArrowUpRight
          className="size-4 shrink-0 text-fg-subtle transition-[color,transform] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg"
          aria-hidden
        />
      </span>

      <span className="relative mt-4 flex flex-wrap gap-1.5">
        {s.targetGrade && (
          <span className="inline-flex h-6 items-center rounded-full bg-[var(--accent-soft)] px-2.5 text-xs font-medium text-fg ring-1 ring-[color-mix(in_srgb,var(--accent)_35%,transparent)] ring-inset">
            Target {s.targetGrade}
          </span>
        )}
        {s.currentGrade && (
          <span className="inline-flex h-6 items-center rounded-full bg-white/[0.05] px-2.5 text-xs font-medium text-fg-muted ring-1 ring-line-strong ring-inset">
            Now {s.currentGrade}
          </span>
        )}
        {s.nextExam && (
          <span
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
              s.nextExam.days <= 14
                ? "bg-cyan-400/10 text-cyan-400 ring-cyan-400/25"
                : "bg-white/[0.05] text-fg-muted ring-line-strong",
            )}
          >
            <CalendarClock className="size-3" aria-hidden />
            {s.nextExam.days === 0
              ? "Exam today"
              : `Exam in ${s.nextExam.days} ${s.nextExam.days === 1 ? "day" : "days"}`}
          </span>
        )}
      </span>

      <dl className="relative [margin-top:max(1rem,auto)] mt-auto grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-sm">
        <div>
          <dt className="text-[0.75rem] text-fg-subtle">Performance</dt>
          <dd className="mt-0.5 font-medium">
            {s.performance ? (
              <>
                {Math.round(s.performance.averagePercent)}%
                <span className="ml-1 text-xs font-normal text-fg-subtle">avg of {s.performance.assessedCount}</span>
              </>
            ) : (
              <span className="font-normal text-fg-muted">Not assessed yet</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[0.75rem] text-fg-subtle">Topics</dt>
          <dd className="mt-0.5 text-fg-muted">
            <span className="flex items-center gap-1.5">
              <BookOpen className="size-3.5 shrink-0" aria-hidden />
              <span className={topics && topics.tracked > 0 ? "font-medium text-fg" : undefined}>{topicText.main}</span>
            </span>
            {topicText.sub && <span className="mt-0.5 block text-xs text-fg-subtle">{topicText.sub}</span>}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="sr-only">Last studied</dt>
          <dd className="text-[0.8125rem] text-fg-subtle">{lastStudiedLabel(s, today)}</dd>
        </div>
      </dl>
    </Link>
  );
}
