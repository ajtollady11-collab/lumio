"use client";

import { Goal, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SaveError } from "@/components/onboarding/save-error";
import { useSave } from "@/components/onboarding/use-save";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { GOAL_FIELDS, type GoalKey } from "@/lib/dashboard/goals";
import type { GoalProgress } from "@/lib/dashboard/model";
import type { WeeklyGoals as Goals } from "@/lib/dashboard/types";
import { clearWeeklyGoals, saveWeeklyGoals } from "@/server/dashboard/actions";
import { EmptyState, Panel } from "./panel";
import { ProgressBar } from "./reveal";

export function WeeklyGoals({
  goals,
  progress,
  weekLabel,
}: {
  goals: Goals | null;
  progress: GoalProgress[];
  weekLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const editButton = (
    <Button variant="ghost" size="sm" icon={<Pencil className="size-3.5" aria-hidden />} onClick={() => setOpen(true)}>
      {goals ? "Edit" : "Set goals"}
    </Button>
  );

  return (
    <Panel id="weekly-goals" title="Weekly goals" icon={Goal} action={goals ? editButton : undefined}>
      {goals ? (
        <>
          <p className="-mt-1 mb-4 text-[0.8125rem] text-fg-subtle">{weekLabel}</p>
          <ul className="space-y-4">
            {progress.map((p) => {
              const met = p.done >= p.target;
              return (
                <li key={p.key}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-fg-muted">{p.label}</span>
                    <span className="tabular-nums">
                      <span className={met ? "font-semibold text-success" : "font-semibold"}>{p.done}</span>
                      <span className="text-fg-subtle">
                        {" "}
                        / {p.target}
                        {p.unit && ` ${p.unit}`}
                      </span>
                    </span>
                  </div>
                  <ProgressBar
                    value={p.done}
                    max={p.target}
                    label={`${p.label}: ${p.done} of ${p.target}`}
                    color={met ? "var(--color-success)" : undefined}
                  />
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-fg-subtle">
            Progress counts tracked learning only — lessons, quizzes, practice and revision.
          </p>
        </>
      ) : (
        <EmptyState
          icon={Goal}
          title="No weekly goals yet"
          action={
            <Button size="sm" onClick={() => setOpen(true)}>
              Set weekly goals
            </Button>
          }
        >
          Choose a target for study time, lessons, subjects or revision sessions. Lumio tracks it against what you
          actually complete.
        </EmptyState>
      )}
      <GoalsDialog open={open} onClose={() => setOpen(false)} goals={goals} />
    </Panel>
  );
}

function GoalsDialog({ open, onClose, goals }: { open: boolean; onClose: () => void; goals: Goals | null }) {
  const router = useRouter();
  const save = useSave();
  const [values, setValues] = useState<Record<GoalKey, string>>(() => initial(goals));
  const [lastGoals, setLastGoals] = useState(goals);
  // Re-sync when saved goals change (derived state, no effect needed).
  if (lastGoals !== goals) {
    setLastGoals(goals);
    setValues(initial(goals));
  }

  const done = () => {
    onClose();
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Weekly goals"
      description="Leave any goal blank to skip it. Weeks run Monday to Sunday."
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save.run(() => saveWeeklyGoals(values), done);
        }}
      >
        {GOAL_FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={`${f.label} (${f.unit})`}
            hint={f.hint}
            type="number"
            inputMode="numeric"
            min={f.min}
            max={f.max}
            step={f.step}
            placeholder="Not set"
            value={values[f.key]}
            error={save.error?.fieldErrors?.[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          />
        ))}
        <SaveError error={save.error?.fieldErrors ? null : save.error} onRetry={save.retry} returnTo="/app" />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          {goals ? (
            <Button
              type="button"
              variant="ghost"
              disabled={save.pending}
              onClick={() => save.run(() => clearWeeklyGoals(), done)}
            >
              Remove goals
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={save.pending}>
              Cancel
            </Button>
            <Button type="submit" loading={save.pending}>
              Save goals
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function initial(goals: Goals | null): Record<GoalKey, string> {
  return Object.fromEntries(
    GOAL_FIELDS.map((f) => [f.key, goals?.[f.key] != null ? String(goals[f.key]) : ""]),
  ) as Record<GoalKey, string>;
}
