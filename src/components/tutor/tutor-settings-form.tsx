"use client";

import { Brain, Check, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TutorOrb } from "@/components/brand/tutor-orb";
import { SaveError } from "@/components/onboarding/save-error";
import { useSave } from "@/components/onboarding/use-save";
import { Button } from "@/components/ui/button";
import { ChipGroup, ChoiceCard } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import {
  DEPTHS,
  PACES,
  PERSONALITIES,
  TEACHING_STYLES,
  optionFor,
  type ExplanationDepth,
  type TeachingPace,
  type TeachingStyle,
  type TutorPersonality,
  type TutorSettings,
} from "@/lib/tutor/options";
import { forgetMemory, saveTutorSettings } from "@/server/tutor/actions";

/** A plain-English summary of the settings — from the same table the AI is given. */
export function describeTutor(t: TutorSettings): string {
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1).replace(/\.$/, "");
  return `I’m ${t.name}. ${optionFor(PERSONALITIES, t.personality).description} I’ll teach in a ${optionFor(TEACHING_STYLES, t.teachingStyle).label.toLowerCase()} way — ${lower(optionFor(TEACHING_STYLES, t.teachingStyle).description)} — at a ${optionFor(PACES, t.pace).label.toLowerCase()} pace (${lower(optionFor(PACES, t.pace).description)}), with ${optionFor(DEPTHS, t.depth).label.toLowerCase()} explanations: ${lower(optionFor(DEPTHS, t.depth).description)}.`;
}

export function TutorSettingsForm({ initial, customised }: { initial: TutorSettings; customised: boolean }) {
  const router = useRouter();
  const [t, setT] = useState<TutorSettings>(initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const save = useSave();
  const dirty = JSON.stringify(t) !== JSON.stringify(initial) || !customised;

  return (
    <form
      noValidate
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        save.run(
          () => saveTutorSettings(t),
          () => {
            setSavedAt(Date.now());
            router.refresh();
          },
        );
      }}
    >
      <div className="surface relative isolate flex flex-col items-center gap-5 overflow-hidden rounded-stage p-6 text-center sm:flex-row sm:text-left">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_10%_50%,rgb(59_123_255/0.18),transparent_60%)]"
        />
        <TutorOrb state="idle" size={84} label={t.name || "Your tutor"} />
        <div>
          <p className="text-sm font-medium text-blue-400">Preview</p>
          <p className="mt-1.5 max-w-xl leading-relaxed text-fg-muted" aria-live="polite">
            {describeTutor({ ...t, name: t.name.trim() || "your tutor" })}
          </p>
        </div>
      </div>

      <TextField
        label="Tutor name"
        hint="Up to 24 characters."
        value={t.name}
        maxLength={24}
        onChange={(e) => setT({ ...t, name: e.target.value })}
        error={save.error?.fieldErrors?.name}
        className="max-w-sm"
      />

      <fieldset>
        <legend className="text-sm font-medium">Personality</legend>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {PERSONALITIES.map((o) => (
            <ChoiceCard
              key={o.value}
              type="radio"
              name="personality"
              checked={t.personality === o.value}
              onChange={() => setT({ ...t, personality: o.value as TutorPersonality })}
              title={o.label}
              description={o.description}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Teaching style</legend>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {TEACHING_STYLES.map((o) => (
            <ChoiceCard
              key={o.value}
              type="radio"
              name="teaching-style"
              checked={t.teachingStyle === o.value}
              onChange={() => setT({ ...t, teachingStyle: o.value as TeachingStyle })}
              title={o.label}
              description={o.description}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <ChipGroup
          label="Pace"
          options={PACES}
          value={t.pace}
          onChange={(v) => v && setT({ ...t, pace: v as TeachingPace })}
        />
        <ChipGroup
          label="Explanation depth"
          options={DEPTHS}
          value={t.depth}
          onChange={(v) => v && setT({ ...t, depth: v as ExplanationDepth })}
        />
      </div>

      <SaveError
        error={save.error?.fieldErrors ? null : save.error}
        onRetry={save.retry}
        returnTo="/app/tutor/settings"
      />
      <div className="flex items-center gap-4">
        <Button type="submit" loading={save.pending} disabled={!dirty && savedAt !== null}>
          Save tutor
        </Button>
        {savedAt && !save.pending && !save.error && (
          <span className="inline-flex items-center gap-1.5 text-sm text-success" role="status">
            <Check className="size-4" aria-hidden /> Saved — {t.name} will use these settings from your next message.
          </span>
        )}
      </div>
    </form>
  );
}

type MemoryItem = {
  id: string;
  kind: string;
  subjectName: string | null;
  topic: string;
  occurrences: number;
  lastSeenAt: string;
};
const KIND_LABEL: Record<string, string> = {
  topic_studied: "Studied together",
  strength: "Strength",
  weakness: "Needs work",
  misconception: "Misconception to revisit",
  note: "Note",
};

export function MemoryPanel({ items, tutorName }: { items: MemoryItem[]; tutorName: string }) {
  const router = useRouter();
  const save = useSave();
  const [confirmAll, setConfirmAll] = useState(false);
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return (
    <section aria-labelledby="memory-heading" className="surface rounded-stage p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="memory-heading"
          className="flex items-center gap-2.5 font-display text-[1.0625rem] font-semibold tracking-tight"
        >
          <Brain className="size-[1.125rem] text-fg-subtle" aria-hidden />
          What {tutorName} remembers
        </h2>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmAll(true)}>
            Forget everything
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        {tutorName} also knows what’s in your profile — your subjects, exam boards, target grades, exam dates and how
        you like to learn — and any quiz results. You can change those in Settings. Below is what has been recorded from
        your sessions. Nothing else is remembered, and parents can’t see this.
      </p>
      <SaveError error={save.error} onRetry={save.retry} returnTo="/app/tutor/settings" />
      {items.length === 0 ? (
        <p className="mt-4 rounded-panel border border-dashed border-line-strong p-4 text-sm text-fg-subtle">
          Nothing recorded yet. When you choose a subject and topic in a conversation, it’s noted here so {tutorName}{" "}
          can build on it next time.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {items.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {m.subjectName ? `${m.subjectName}: ` : ""}
                  {m.topic}
                </p>
                <p className="text-[0.8125rem] text-fg-subtle">
                  {KIND_LABEL[m.kind] ?? m.kind}
                  {m.occurrences > 1 ? ` · ${m.occurrences} times` : ""} · last {fmt.format(new Date(m.lastSeenAt))}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Forget ${m.topic}`}
                icon={<Trash2 className="size-4" aria-hidden />}
                disabled={save.pending}
                onClick={() =>
                  save.run(
                    () => forgetMemory(m.id),
                    () => router.refresh(),
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title="Forget everything?"
        description={`${tutorName} will forget every item listed here. Your profile, conversations and results aren’t affected.`}
      >
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmAll(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={save.pending}
            onClick={() =>
              save.run(
                () => forgetMemory("all"),
                () => {
                  setConfirmAll(false);
                  router.refresh();
                },
              )
            }
          >
            Forget everything
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
