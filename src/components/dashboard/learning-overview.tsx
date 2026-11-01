import { Activity, BookCheck, Clock3, Flame, GraduationCap, Target, type LucideIcon } from "lucide-react";
import { formatMinutes } from "@/lib/dashboard/model";
import type { DashboardActivity } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils/cn";
import { Panel } from "./panel";

type Metric = {
  label: string;
  icon: LucideIcon;
  /** null → no data yet; show `empty` instead of a number. */
  value: string | null;
  detail?: string;
  empty: string;
};

/**
 * Six headline figures, each from a real source. "Topics completed" needs
 * topic-level tracking that arrives with lessons, so it says so rather than
 * showing a zero that looks like a result.
 */
export function LearningOverview({ activity, subjectCount }: { activity: DashboardActivity; subjectCount: number }) {
  const t = activity.totals;
  const hasActivity = t.events > 0;
  const minutes = Math.floor(t.activeSeconds / 60);

  const metrics: Metric[] = [
    {
      label: "Lessons completed",
      icon: BookCheck,
      value: hasActivity ? String(t.lessonsCompleted) : null,
      empty: "Starts with your first lesson",
    },
    {
      label: "Active study time",
      icon: Clock3,
      value: hasActivity ? formatMinutes(minutes) : null,
      empty: "Only real learning counts",
    },
    {
      label: "Subjects",
      icon: GraduationCap,
      value: String(subjectCount),
      detail: "from your profile",
      empty: "",
    },
    {
      label: "Topics completed",
      icon: Target,
      value: null,
      empty: "Tracked once lessons begin",
    },
    {
      label: "Quiz average",
      icon: Activity,
      value: t.quizAveragePercent !== null ? `${Math.round(t.quizAveragePercent)}%` : null,
      detail: t.quizzesCompleted ? `${t.quizzesCompleted} ${t.quizzesCompleted === 1 ? "quiz" : "quizzes"}` : undefined,
      empty: "No quizzes yet",
    },
    {
      label: "Current streak",
      icon: Flame,
      value: hasActivity ? `${activity.streak.current} ${activity.streak.current === 1 ? "day" : "days"}` : null,
      empty: "Starts with your first session",
    },
  ];

  return (
    <Panel id="overview" title="Learning overview" icon={Activity}>
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className={cn(
                "rounded-panel border p-4 transition-colors",
                m.value === null ? "border-dashed border-line" : "border-line bg-white/[0.025]",
              )}
            >
              <dt className="flex items-center gap-1.5 text-[0.8125rem] text-fg-subtle">
                <Icon className="size-3.5" aria-hidden />
                {m.label}
              </dt>
              <dd className="mt-2">
                {m.value === null ? (
                  <span className="block text-sm leading-snug text-fg-muted">{m.empty}</span>
                ) : (
                  <>
                    <span className="block font-display text-2xl leading-none font-semibold tracking-tight tabular-nums">
                      {m.value}
                    </span>
                    {m.detail && <span className="mt-1.5 block text-xs text-fg-subtle">{m.detail}</span>}
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </Panel>
  );
}
