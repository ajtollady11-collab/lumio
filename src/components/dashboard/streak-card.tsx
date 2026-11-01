import { Flame } from "lucide-react";
import type { DashboardActivity } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils/cn";
import { Panel } from "./panel";

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", { weekday: "narrow", timeZone: "UTC" });
const DAY_FULL = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Current and best streak, plus this week (Mon–Sun) in the student's timezone. */
export function StreakCard({ activity }: { activity: DashboardActivity }) {
  const { current, best } = activity.streak;
  const studiedToday = activity.days.find((d) => d.date === activity.today)?.qualified ?? false;

  return (
    <Panel id="streak" title="Study streak" icon={Flame}>
      <div className="flex items-end gap-6">
        <div>
          <p className="font-display text-[2.75rem] leading-none font-semibold tracking-tight tabular-nums">
            {current}
            <span className="ml-1.5 text-base font-medium text-fg-muted">{current === 1 ? "day" : "days"}</span>
          </p>
          <p className="mt-1.5 text-sm text-fg-subtle">Current streak</p>
        </div>
        <div className="pb-1">
          <p className="font-display text-xl leading-none font-semibold text-fg-muted tabular-nums">{best}</p>
          <p className="mt-1.5 text-sm text-fg-subtle">Best</p>
        </div>
      </div>

      <ol className="mt-5 grid grid-cols-7 gap-1.5" aria-label="This week">
        {activity.days.map((d) => {
          const isToday = d.date === activity.today;
          const future = d.date > activity.today;
          const date = new Date(`${d.date}T00:00:00Z`);
          return (
            <li key={d.date} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "grid aspect-square w-full max-w-9 place-items-center rounded-[0.625rem] border transition-colors",
                  d.qualified
                    ? "border-transparent bg-gradient-to-br from-blue-500 to-violet-500 shadow-[0_6px_18px_-8px_rgb(59_123_255/0.9)]"
                    : future
                      ? "border-dashed border-line"
                      : "border-line-strong bg-white/[0.03]",
                  isToday && !d.qualified && "border-cyan-400/60",
                )}
              >
                <span className="sr-only">
                  {DAY_FULL.format(date)}: {d.qualified ? "studied" : future ? "upcoming" : "no qualifying study"}
                </span>
              </span>
              <span
                aria-hidden
                className={cn("text-[0.6875rem]", isToday ? "font-semibold text-cyan-400" : "text-fg-subtle")}
              >
                {DAY_LABEL.format(date)}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-[0.8125rem] leading-relaxed text-fg-subtle">
        {studiedToday
          ? "Today counts. Come back tomorrow to keep it going."
          : current > 0
            ? "Complete a lesson, quiz or practice session today to keep your streak."
            : "Days count when you complete a lesson, quiz, exam practice or 5+ minutes of revision. Opening the app doesn't."}
      </p>
    </Panel>
  );
}
