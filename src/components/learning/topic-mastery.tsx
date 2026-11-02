"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, MessageCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SaveError } from "@/components/onboarding/save-error";
import { useSave } from "@/components/onboarding/use-save";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MASTERY_LEVELS, type MasteryLevel } from "@/lib/learning/levels";
import type { SubjectRef, TopicView } from "@/lib/learning/profile";
import { tutorHref } from "@/lib/recommendations/engine";
import { cn } from "@/lib/utils/cn";
import { resetTopic } from "@/server/learning/actions";
import { MasteryLabel, MasteryMeter } from "./mastery-meter";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
const fmt = (iso: string) => DATE.format(new Date(iso));
const level = (n: number) => MASTERY_LEVELS[Math.min(6, Math.max(1, n)) as MasteryLevel];

export type SubjectTopics = {
  subject: SubjectRef;
  topics: TopicView[];
  counts: { tracked: number; assessed: number; strong: number; toImprove: number };
};

/** One subject's topics: meter, label, evidence, and an expandable "why". */
export function SubjectTopicList({ group }: { group: SubjectTopics }) {
  const { subject, topics, counts } = group;
  return (
    <div className="rounded-panel border border-line bg-ink-900/35">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3">
        <h3 className="flex items-center gap-2.5 font-medium">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: subject.accent }} />
          {subject.name}
        </h3>
        <p className="text-[0.8125rem] text-fg-subtle">
          {counts.tracked === 0
            ? "No topics yet"
            : `${counts.tracked} ${counts.tracked === 1 ? "topic" : "topics"} · ${counts.assessed} assessed`}
        </p>
      </div>
      {topics.length === 0 ? (
        <p className="px-4 py-4 text-sm text-fg-muted">
          Choose {subject.name} and a topic when you talk to your tutor — it appears here once you’ve answered a
          question on it.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {topics.map((t) => (
            <TopicRow key={t.topicKey} topic={t} subject={subject} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TopicRow({ topic: t, subject }: { topic: TopicView; subject: SubjectRef }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  const save = useSave();
  const panelId = `topic-${subject.id}-${t.topicKey.replace(/\s+/g, "-")}`;
  const answered = t.evidenceCount;

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.02] sm:grid-cols-[minmax(0,1fr)_9rem_8.5rem_auto]"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{t.topic}</span>
          <span className="block text-[0.8125rem] text-fg-subtle">
            {answered === 0
              ? "Studied — no answers yet"
              : `${answered} ${answered === 1 ? "answer" : "answers"} · ${t.correctCount} right`}
            {t.weak && <span className="text-warning"> · needs work</span>}
          </span>
        </span>
        <MasteryMeter level={t.level} assessed={t.assessed} topic={t.topic} className="hidden sm:flex" />
        <span className="hidden text-sm sm:block">
          <MasteryLabel level={t.level} assessed={t.assessed} />
        </span>
        <span className="flex items-center gap-3">
          <span className="text-sm sm:hidden">
            <MasteryLabel level={t.level} assessed={t.assessed} />
          </span>
          <ChevronDown
            className={cn("size-4 text-fg-subtle transition-transform duration-200", open && "rotate-180")}
            aria-hidden
          />
        </span>
        <MasteryMeter
          level={t.level}
          assessed={t.assessed}
          topic={t.topic}
          className="col-span-2 max-w-none sm:hidden"
          decorative
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-4 pt-1 pb-4 text-sm">
              <p className="leading-relaxed text-fg-muted">
                {t.assessed ? level(t.level).meaning : MASTERY_LEVELS[2].meaning}{" "}
                {!t.assessed && "Answer at least two questions on it to get a level."}
              </p>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Fact term="Answers recorded" value={String(t.evidenceCount)} />
                <Fact term="Right" value={String(t.correctCount)} />
                <Fact term="Not right" value={String(t.incorrectCount)} />
                <Fact term="Last practised" value={t.lastEvidenceAt ? fmt(t.lastEvidenceAt) : "—"} />
              </dl>
              {t.history.length > 0 && (
                <div>
                  <p className="text-[0.75rem] font-medium tracking-wide text-fg-subtle uppercase">How it’s changed</p>
                  <ol className="mt-2 space-y-1.5">
                    {t.history.map((c) => (
                      <li key={c.changedAt + c.toLevel} className="flex flex-wrap gap-x-2 text-fg-muted">
                        <span className="w-14 shrink-0 text-fg-subtle tabular-nums">{fmt(c.changedAt)}</span>
                        <span>
                          {level(c.fromLevel).short} → <span className="text-fg">{level(c.toLevel).short}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Link
                  href={tutorHref(subject.slug, t.topic)}
                  className="inline-flex h-9 items-center gap-2 rounded-control bg-blue-500/12 px-3.5 font-medium text-blue-400 ring-1 ring-blue-400/25 transition-colors ring-inset hover:bg-blue-500/20"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  Practise with your tutor
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RotateCcw className="size-4" aria-hidden />}
                  onClick={() => setConfirm(true)}
                >
                  Reset topic
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Reset ${t.topic}?`}
        description="This deletes every answer recorded for this topic, its level and history, and any notes about it. Your conversations aren’t affected."
      >
        <SaveError error={save.error} onRetry={save.retry} returnTo="/app/progress" />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={save.pending}
            onClick={() =>
              save.run(
                () => resetTopic({ subjectId: subject.id, topicKey: t.topicKey }),
                () => {
                  setConfirm(false);
                  router.refresh();
                },
              )
            }
          >
            Reset topic
          </Button>
        </div>
      </Dialog>
    </li>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="rounded-control bg-white/[0.03] px-3 py-2">
      <dt className="text-[0.75rem] text-fg-subtle">{term}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  );
}
