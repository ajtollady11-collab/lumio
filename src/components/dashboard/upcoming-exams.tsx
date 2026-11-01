import { CalendarDays, CalendarPlus } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { formatExamDate } from "@/lib/onboarding/dates";
import type { ExamSummary } from "@/lib/dashboard/model";
import { cn } from "@/lib/utils/cn";
import { EmptyState, Panel } from "./panel";

export function UpcomingExams({ exams, limit = 5 }: { exams: ExamSummary[]; limit?: number }) {
  const shown = exams.slice(0, limit);
  const soon = exams.some((e) => e.urgency === "soon");
  return (
    <Panel
      id="exams"
      title="Upcoming exams"
      icon={CalendarDays}
      highlight={soon}
      action={exams.length ? { label: "Manage", href: "/app/settings#exams" } : undefined}
    >
      {shown.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="No exam dates yet"
          action={
            <ButtonLink href="/app/settings#exams" variant="secondary" size="sm">
              Add exam dates
            </ButtonLink>
          }
        >
          Add your papers to see countdowns here and get revision suggestions timed to them.
        </EmptyState>
      ) : (
        <ol className="space-y-2">
          {shown.map((e) => (
            <li key={e.id}>
              <Link
                href={`/app/subjects/${e.slug}#exams`}
                className={cn(
                  "group flex items-center gap-4 rounded-panel border p-3 pr-4 transition-colors",
                  e.urgency === "soon"
                    ? "border-cyan-400/30 bg-cyan-400/[0.05] hover:border-cyan-400/50"
                    : "border-transparent hover:border-line hover:bg-white/[0.025]",
                )}
              >
                <span
                  className={cn(
                    "grid size-14 shrink-0 place-items-center rounded-control text-center",
                    e.urgency === "soon" ? "bg-cyan-400/12 text-cyan-400" : "bg-white/[0.04] text-fg",
                  )}
                >
                  <span>
                    <span className="block font-display text-xl leading-none font-semibold tabular-nums">{e.days}</span>
                    <span className="mt-0.5 block text-[0.625rem] tracking-wide text-fg-subtle uppercase">
                      {e.days === 1 ? "day" : "days"}
                    </span>
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: e.accent.hex }} />
                    <span className="truncate font-medium">{e.subjectName}</span>
                    {e.days === 0 && <span className="text-xs font-semibold text-cyan-400">Today</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-fg-muted">
                    {formatExamDate(e.date)}
                    {e.notes ? ` · ${e.notes}` : ""}
                  </span>
                  <span className="block truncate text-[0.8125rem] text-fg-subtle">
                    {e.qualificationName}
                    {e.boardName ? ` · ${e.boardName}` : " · board not set"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {exams.length > limit && (
        <p className="mt-3 text-sm text-fg-subtle">
          +{exams.length - limit} more ·{" "}
          <Link href="/app/settings#exams" className="text-blue-400 hover:text-blue-300">
            See all
          </Link>
        </p>
      )}
    </Panel>
  );
}
