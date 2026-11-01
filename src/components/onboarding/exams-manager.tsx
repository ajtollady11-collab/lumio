"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarPlus, Pencil, Trash2 } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { daysUntil, formatExamDate } from "@/lib/onboarding/dates";
import { recordStep, removeExam, saveExam } from "@/server/onboarding/student-actions";
import type { ReferenceData } from "@/server/curriculum/reference";
import type { ExamRow, StudentSubjectRow } from "@/server/onboarding/student-data";
import { SaveError } from "./save-error";
import { SettingsSectionHeader, StepFooter, StepHeader, type StepHost } from "./step-frame";
import { useSave } from "./use-save";

type Draft = { id?: string; subjectId: string; examDate: string; notes: string };

/**
 * Add, edit and remove exam dates. Each change saves immediately, so nothing
 * is lost if the student leaves part-way.
 */
export function ExamsManager({
  host,
  reference,
  subjects,
  exams,
  today,
  onChange,
}: {
  host: StepHost;
  reference: ReferenceData;
  subjects: StudentSubjectRow[];
  exams: ExamRow[];
  today: string;
  onChange: (exams: ExamRow[]) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const save = useSave();
  const remove = useSave();
  const advance = useSave();
  const formId = useId();
  const errs = save.error?.fieldErrors ?? {};
  const subjectName = (id: string) => reference.subjects.find((s) => s.id === id)?.name ?? "Subject";
  const boardName = (id: string | null) => reference.examBoards.find((b) => b.id === id)?.name;
  const sorted = [...exams].sort((a, b) => a.examDate.localeCompare(b.examDate));

  function startAdd() {
    save.clear();
    setDraft({ subjectId: subjects[0]?.subjectId ?? "", examDate: "", notes: "" });
  }

  function submitDraft(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const payload = { ...draft, notes: draft.notes };
    save.run(
      () => saveExam(payload),
      (row) => {
        onChange(draft.id ? exams.map((x) => (x.id === row.id ? row : x)) : [...exams, row]);
        setDraft(null);
      },
    );
  }

  function onRemove(id: string) {
    remove.run(
      () => removeExam(id),
      () => onChange(exams.filter((x) => x.id !== id)),
    );
  }

  function finish(e: FormEvent) {
    e.preventDefault();
    advance.run(
      async () => {
        await recordStep(host.advanceTo);
        return { ok: true as const, data: null };
      },
      () => host.onDone?.(),
    );
  }

  const header =
    host.variant === "onboarding" ? (
      <StepHeader title="When are your exams?">
        Add the papers you know about so your tutor can plan revision around them. This is optional — you can add dates
        later in Settings.
      </StepHeader>
    ) : (
      <SettingsSectionHeader title="Exam dates">
        Your upcoming papers. Changes save straight away.
      </SettingsSectionHeader>
    );

  return (
    <div>
      {header}

      {sorted.length > 0 && (
        <ul className="mb-4 space-y-2">
          <AnimatePresence initial={false}>
            {sorted.map((exam) => {
              const days = daysUntil(exam.examDate, today);
              return (
                <motion.li
                  key={exam.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-4 rounded-panel border border-line bg-ink-900/40 p-4"
                >
                  <div className="w-14 shrink-0 text-center">
                    <p className="font-display text-2xl leading-none font-semibold tabular-nums">{Math.max(days, 0)}</p>
                    <p className="mt-1 text-[0.6875rem] text-fg-subtle">{days === 1 ? "day" : "days"}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{subjectName(exam.subjectId)}</p>
                    <p className="text-sm text-fg-muted">
                      {formatExamDate(exam.examDate)}
                      {boardName(exam.examBoardId) ? `, ${boardName(exam.examBoardId)}` : ""}
                    </p>
                    {exam.notes && <p className="mt-0.5 truncate text-[0.8125rem] text-fg-subtle">{exam.notes}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label={`Edit ${subjectName(exam.subjectId)} exam`}
                      onClick={() => {
                        save.clear();
                        setDraft({
                          id: exam.id,
                          subjectId: exam.subjectId,
                          examDate: exam.examDate,
                          notes: exam.notes ?? "",
                        });
                      }}
                      className="flex size-10 items-center justify-center rounded-control text-fg-muted hover:bg-white/[0.06] hover:text-fg"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${subjectName(exam.subjectId)} exam`}
                      onClick={() => onRemove(exam.id)}
                      disabled={remove.pending}
                      className="flex size-10 items-center justify-center rounded-control text-fg-muted hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      <SaveError error={remove.error} onRetry={remove.retry} returnTo={host.returnTo} />

      <AnimatePresence mode="wait" initial={false}>
        {draft ? (
          <motion.form
            key="form"
            id={formId}
            onSubmit={submitDraft}
            noValidate
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="surface space-y-4 rounded-panel p-4 sm:p-5"
          >
            <p className="font-medium">{draft.id ? "Edit exam" : "Add an exam"}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Subject
                <select
                  value={draft.subjectId}
                  onChange={(e) => setDraft({ ...draft, subjectId: e.target.value })}
                  aria-invalid={errs.subjectId ? true : undefined}
                  className="h-11 rounded-control border border-line-strong bg-ink-850 px-3 text-[0.9375rem] font-normal outline-none focus:border-blue-400/70"
                >
                  {subjects.map((s) => (
                    <option key={s.subjectId} value={s.subjectId}>
                      {subjectName(s.subjectId)}
                    </option>
                  ))}
                </select>
                {errs.subjectId && <span className="text-[0.8125rem] font-normal text-danger">{errs.subjectId}</span>}
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Date
                <input
                  type="date"
                  min={today}
                  value={draft.examDate}
                  onChange={(e) => setDraft({ ...draft, examDate: e.target.value })}
                  aria-invalid={errs.examDate ? true : undefined}
                  className="h-11 rounded-control border border-line-strong bg-ink-850 px-3 text-[0.9375rem] font-normal [color-scheme:dark] outline-none focus:border-blue-400/70"
                />
                {errs.examDate && <span className="text-[0.8125rem] font-normal text-danger">{errs.examDate}</span>}
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Notes <span className="font-normal text-fg-subtle">(optional)</span>
              </span>
              <input
                type="text"
                maxLength={200}
                value={draft.notes}
                placeholder="e.g. Paper 2, morning"
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                className="h-11 rounded-control border border-line-strong bg-ink-850 px-3 text-[0.9375rem] font-normal outline-none placeholder:text-fg-subtle focus:border-blue-400/70"
              />
              {errs.notes && <span className="text-[0.8125rem] font-normal text-danger">{errs.notes}</span>}
            </label>
            {save.error && !save.error.fieldErrors && (
              <SaveError error={save.error} onRetry={save.retry} returnTo={host.returnTo} />
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={save.pending}>
                {draft.id ? "Save exam" : "Add exam"}
              </Button>
            </div>
          </motion.form>
        ) : (
          <motion.div key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Button
              type="button"
              variant="secondary"
              onClick={startAdd}
              disabled={subjects.length === 0}
              icon={<CalendarPlus className="size-4" aria-hidden />}
            >
              {sorted.length ? "Add another exam" : "Add an exam"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {host.variant === "onboarding" && (
        <form onSubmit={finish}>
          <StepFooter
            host={host}
            pending={advance.pending}
            error={advance.error}
            submitLabel={exams.length ? "Continue" : "Skip for now"}
            disabled={Boolean(draft)}
          />
        </form>
      )}
    </div>
  );
}
