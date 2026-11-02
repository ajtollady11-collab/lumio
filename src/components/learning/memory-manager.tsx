"use client";

import { Check, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { SaveError } from "@/components/onboarding/save-error";
import { useSave } from "@/components/onboarding/use-save";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { InsightRow } from "@/lib/learning/profile";
import { cn } from "@/lib/utils/cn";
import { clearLearningMemory, deleteInsight, updateInsight } from "@/server/learning/actions";

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});
const fmt = (iso: string) => DATE.format(new Date(iso));

export const INSIGHT_KIND: Record<InsightRow["kind"], { label: string; tone: string }> = {
  weakness: { label: "Area to improve", tone: "bg-warning/10 text-warning ring-warning/25" },
  misconception: { label: "Misconception", tone: "bg-danger/10 text-danger ring-danger/25" },
  strength: { label: "Strength", tone: "bg-violet-500/12 text-violet-400 ring-violet-400/25" },
  learning_pattern: { label: "What helps you", tone: "bg-cyan-400/10 text-cyan-400 ring-cyan-400/25" },
  note: { label: "Note", tone: "bg-white/[0.05] text-fg-muted ring-line-strong" },
  topic_studied: { label: "Studied", tone: "bg-white/[0.05] text-fg-muted ring-line-strong" },
};

const CONFIDENCE: Record<InsightRow["confidence"], string> = {
  low: "Low confidence — seen once",
  medium: "Medium confidence",
  high: "High confidence — seen repeatedly",
};

const STATUS: Record<InsightRow["status"], string | null> = {
  active: null,
  confirmed: "You confirmed this",
  corrected: "You corrected this",
  dismissed: "Dismissed — your tutor ignores it",
};

/**
 * Everything Lumio has recorded about the student, with the controls the
 * spec requires: see when and why, confirm, correct, dismiss, delete, clear.
 */
export function MemoryManager({
  insights,
  subjectNames,
  tutorName,
  hasAnyData,
}: {
  insights: InsightRow[];
  /** subjectId → display name. A plain object: functions can't cross the server/client boundary. */
  subjectNames: Record<string, string>;
  tutorName: string;
  /** True when mastery rows exist even if no insights do — "clear all" still applies. */
  hasAnyData: boolean;
}) {
  const router = useRouter();
  const clear = useSave();
  const [confirmAll, setConfirmAll] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const active = insights.filter((i) => i.status !== "dismissed");
  const dismissed = insights.filter((i) => i.status === "dismissed");

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm leading-relaxed text-fg-muted">
          {tutorName} reads these before teaching you. Each one says why it was recorded. If something’s wrong, correct
          or dismiss it and {tutorName} will follow your version. Only you can see this — parents can’t, even if you
          share progress with them.
        </p>
        {hasAnyData && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmAll(true)}>
            Clear all learning memory
          </Button>
        )}
      </div>

      {active.length === 0 ? (
        <p className="mt-4 rounded-panel border border-dashed border-line-strong p-4 text-sm text-fg-subtle">
          Nothing recorded yet. Insights appear here after you’ve answered several of {tutorName}’s questions on a topic
          — a single answer, or just asking a question, never creates one.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {active.map((i) => (
            <InsightItem
              key={i.id}
              insight={i}
              subjectName={i.subjectId ? (subjectNames[i.subjectId] ?? null) : null}
            />
          ))}
        </ul>
      )}

      {dismissed.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            aria-expanded={showDismissed}
            onClick={() => setShowDismissed((v) => !v)}
            className="text-sm text-fg-subtle underline-offset-4 hover:text-fg hover:underline"
          >
            {showDismissed ? "Hide" : "Show"} {dismissed.length} dismissed
          </button>
          {showDismissed && (
            <ul className="mt-2.5 space-y-2.5">
              {dismissed.map((i) => (
                <InsightItem
                  key={i.id}
                  insight={i}
                  subjectName={i.subjectId ? (subjectNames[i.subjectId] ?? null) : null}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <Dialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title="Clear all learning memory?"
        description={`${tutorName} will forget every insight, topic level and recorded answer. Your conversations, profile and settings aren’t affected. This can’t be undone.`}
      >
        <SaveError error={clear.error} onRetry={clear.retry} returnTo="/app/progress" />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmAll(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={clear.pending}
            onClick={() =>
              clear.run(
                () => clearLearningMemory("clear"),
                () => {
                  setConfirmAll(false);
                  router.refresh();
                },
              )
            }
          >
            Clear everything
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function InsightItem({ insight: i, subjectName }: { insight: InsightRow; subjectName: string | null }) {
  const router = useRouter();
  const save = useSave();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(i.studentNote ?? "");
  const noteId = useId();
  const kind = INSIGHT_KIND[i.kind];
  const status = STATUS[i.status];
  const done = () => {
    setEditing(false);
    router.refresh();
  };
  const title = subjectName ? `${subjectName} · ${i.topic}` : i.topic;

  return (
    <li className={cn("rounded-panel border border-line bg-ink-900/35 p-4", i.status === "dismissed" && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
            kind.tone,
          )}
        >
          {kind.label}
        </span>
        {status && (
          <span className="inline-flex items-center gap-1 text-xs text-fg-subtle">
            {i.status === "confirmed" && <Check className="size-3.5" aria-hidden />}
            {status}
          </span>
        )}
      </div>
      <p className="mt-2 font-medium">{title}</p>
      {i.detail && <p className="mt-1 text-sm text-fg-muted">{i.detail}</p>}
      {i.studentNote && i.status === "corrected" && (
        <p className="mt-2 rounded-control bg-blue-500/8 px-3 py-2 text-sm text-fg">
          <span className="text-fg-subtle">Your correction: </span>
          {i.studentNote}
        </p>
      )}
      <dl className="mt-2.5 space-y-0.5 text-[0.8125rem] text-fg-subtle">
        {i.evidenceSummary && (
          <div className="flex gap-1.5">
            <dt>Why:</dt>
            <dd className="text-fg-muted">{i.evidenceSummary}</dd>
          </div>
        )}
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="sr-only">Recorded</dt>
          <dd>
            Recorded {fmt(i.firstSeenAt)}
            {i.lastSeenAt.slice(0, 10) !== i.firstSeenAt.slice(0, 10) && ` · updated ${fmt(i.lastSeenAt)}`}
          </dd>
          <dt className="sr-only">Confidence</dt>
          <dd>· {CONFIDENCE[i.confidence]}</dd>
        </div>
      </dl>

      {editing ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.run(() => updateInsight({ id: i.id, action: "correct", note }), done);
          }}
        >
          <label htmlFor={noteId} className="text-sm font-medium">
            What’s actually right?
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="e.g. I understand this now — I mixed up the terms that day."
            className="w-full resize-y rounded-control border border-line-strong bg-ink-900/70 px-3.5 py-2.5 text-[0.9375rem] text-fg outline-none placeholder:text-fg-subtle focus:border-blue-400/70 focus:shadow-[0_0_0_4px_rgb(59_123_255/0.18)]"
          />
          <SaveError error={save.error} onRetry={save.retry} returnTo="/app/progress" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={save.pending}>
              Save correction
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <SaveError error={save.error} onRetry={save.retry} returnTo="/app/progress" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {i.status === "dismissed" ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={save.pending}
                icon={<RotateCcw className="size-4" aria-hidden />}
                onClick={() => save.run(() => updateInsight({ id: i.id, action: "restore" }), done)}
              >
                Restore
              </Button>
            ) : (
              <>
                {i.status !== "confirmed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={save.pending}
                    icon={<Check className="size-4" aria-hidden />}
                    onClick={() => save.run(() => updateInsight({ id: i.id, action: "confirm" }), done)}
                  >
                    That’s right
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={save.pending}
                  icon={<Pencil className="size-4" aria-hidden />}
                  onClick={() => setEditing(true)}
                >
                  Correct it
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={save.pending}
                  icon={<X className="size-4" aria-hidden />}
                  onClick={() => save.run(() => updateInsight({ id: i.id, action: "dismiss" }), done)}
                >
                  Dismiss
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={save.pending}
              aria-label={`Delete “${i.topic}”`}
              icon={<Trash2 className="size-4" aria-hidden />}
              onClick={() => save.run(() => deleteInsight(i.id), done)}
            >
              Delete
            </Button>
          </div>
        </>
      )}
    </li>
  );
}
