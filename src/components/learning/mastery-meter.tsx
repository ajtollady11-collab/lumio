import { MASTERY_LEVELS, type MasteryLevel } from "@/lib/learning/levels";
import { cn } from "@/lib/utils/cn";

/**
 * Five steps from Introduced to Mastered ("Not started" has no row, so no
 * step). Unassessed topics draw outlined steps only — never a fill that could
 * be read as a score.
 */
const STEPS: MasteryLevel[] = [2, 3, 4, 5, 6];

const FILL: Record<MasteryLevel, string> = {
  1: "bg-line-strong",
  2: "bg-fg-subtle/60",
  3: "bg-warning/80",
  4: "bg-blue-400",
  5: "bg-violet-400",
  6: "bg-cyan-400",
};

export function MasteryMeter({
  level,
  assessed,
  topic,
  className,
  decorative,
}: {
  level: number;
  assessed: boolean;
  topic: string;
  className?: string;
  /** A second copy of the same meter (e.g. the phone layout) — hidden from assistive tech. */
  decorative?: boolean;
}) {
  const l = Math.min(6, Math.max(1, level)) as MasteryLevel;
  const label = assessed ? MASTERY_LEVELS[l].label : "Not assessed yet";
  return (
    <div
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `${topic}: ${label}`}
      aria-hidden={decorative || undefined}
      className={cn("flex h-2 w-full max-w-36 items-stretch gap-1", className)}
    >
      {STEPS.map((step) => (
        <span
          key={step}
          className={cn(
            "flex-1 rounded-full",
            assessed && step <= l ? FILL[l] : "bg-transparent ring-1 ring-line-strong ring-inset",
            !assessed && step === 2 && l >= 2 && "bg-fg-subtle/30 ring-0",
          )}
        />
      ))}
    </div>
  );
}

export function MasteryLabel({ level, assessed }: { level: number; assessed: boolean }) {
  const l = Math.min(6, Math.max(1, level)) as MasteryLevel;
  if (!assessed) return <span className="text-fg-subtle">{l <= 1 ? MASTERY_LEVELS[1].short : "Not assessed yet"}</span>;
  return (
    <span
      className={cn(
        "font-medium",
        l === 6 ? "text-cyan-400" : l === 5 ? "text-violet-400" : l === 4 ? "text-blue-400" : "text-warning",
      )}
    >
      {MASTERY_LEVELS[l].short}
    </span>
  );
}
