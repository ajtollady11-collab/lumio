"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookMarked,
  CircleHelp,
  Eye,
  Feather,
  GraduationCap,
  Lightbulb,
  ListTree,
  MessagesSquare,
  Search,
  X,
} from "lucide-react";
import { useId, useMemo, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { ChipGroup, ChoiceCard } from "@/components/ui/choice";
import { TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import {
  AGE_BANDS,
  CONFIDENCE_OPTIONS,
  EDUCATION_LEVELS,
  GRADE_SCALES,
  LEARNING_PREFERENCES,
  SCHOOL_YEARS,
  SUGGESTED_QUALIFICATION,
  gradeIsValid,
  type AgeBand,
  type Confidence,
  type EducationLevel,
  type LearningPreference,
} from "@/lib/onboarding/options";
import { cn } from "@/lib/utils/cn";
import type { ReferenceData } from "@/server/curriculum/reference";
import {
  saveAbout,
  saveBoards,
  saveGoals,
  savePreferences,
  saveQualification,
  saveSubjects,
} from "@/server/onboarding/student-actions";
import type { StudentSnapshot, StudentSubjectRow } from "@/server/onboarding/student-data";
import { SettingsSectionHeader, StepFooter, StepHeader, type StepHost } from "./step-frame";
import { useSave } from "./use-save";

type Profile = StudentSnapshot["profile"];

function Heading({ host, title, children }: { host: StepHost; title: string; children?: React.ReactNode }) {
  return host.variant === "onboarding" ? (
    <StepHeader title={title}>{children}</StepHeader>
  ) : (
    <SettingsSectionHeader title={title}>{children}</SettingsSectionHeader>
  );
}

// ---------------------------------------------------------------------------
// 1 · About you
// ---------------------------------------------------------------------------
export function AboutStep({
  host,
  profile,
  onSaved,
}: {
  host: StepHost;
  profile: Profile;
  onSaved: (p: Partial<Profile>) => void;
}) {
  const [firstName, setFirstName] = useState(profile.firstName ?? "");
  const [ageBand, setAgeBand] = useState<AgeBand | null>(profile.ageBand);
  const [schoolYear, setSchoolYear] = useState<number | null>(profile.schoolYear);
  const [level, setLevel] = useState<EducationLevel | null>(profile.educationLevel);
  const [savedAt, setSavedAt] = useState<number>();
  const save = useSave();
  const errs = save.error?.fieldErrors ?? {};

  function submit(e: FormEvent) {
    e.preventDefault();
    const values = { firstName, ageBand, schoolYear, educationLevel: level };
    save.run(
      () => saveAbout(values, { advanceTo: host.advanceTo }),
      () => {
        onSaved({ firstName: firstName.trim(), ageBand, schoolYear, educationLevel: level });
        setSavedAt(Date.now());
        host.onDone?.();
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <Heading host={host} title={host.variant === "onboarding" ? "Let's start with you" : "About you"}>
        {host.variant === "onboarding"
          ? "A few basics so your tutor pitches everything at the right level."
          : "Your name, age and stage of education."}
      </Heading>
      <div className="space-y-7">
        <TextField
          label="First name"
          name="firstName"
          autoComplete="given-name"
          maxLength={40}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          error={errs.firstName}
          className="max-w-sm"
        />
        <ChipGroup
          label="How old are you?"
          options={AGE_BANDS}
          value={ageBand}
          onChange={setAgeBand}
          error={errs.ageBand}
        />
        {ageBand === "under_13" && (
          <Notice>
            Because you&apos;re under 13, a parent or carer will need to link their Lumio account before your tutor
            starts teaching. You can still finish setting up now.
          </Notice>
        )}
        <ChipGroup
          label="Which school year are you in?"
          options={SCHOOL_YEARS}
          value={schoolYear}
          onChange={setSchoolYear}
          error={errs.schoolYear}
        />
        <fieldset>
          <legend className="mb-2.5 text-sm font-medium">What are you studying for?</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {EDUCATION_LEVELS.map((l) => (
              <ChoiceCard
                key={l.value}
                type="radio"
                name="educationLevel"
                checked={level === l.value}
                onChange={() => setLevel(l.value)}
                title={l.label}
                description={l.description}
              />
            ))}
          </div>
          {errs.educationLevel && <p className="mt-2 text-[0.8125rem] text-danger">{errs.educationLevel}</p>}
        </fieldset>
      </div>
      <StepFooter host={host} pending={save.pending} error={save.error} onRetry={save.retry} savedAt={savedAt} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// 2 · Qualification
// ---------------------------------------------------------------------------
export function QualificationStep({
  host,
  profile,
  reference,
  onSaved,
}: {
  host: StepHost;
  profile: Profile;
  reference: ReferenceData;
  onSaved: (p: Partial<Profile>) => void;
}) {
  const suggestedSlug = profile.educationLevel ? SUGGESTED_QUALIFICATION[profile.educationLevel] : null;
  const suggested = reference.qualifications.find((q) => q.slug === suggestedSlug)?.id ?? null;
  const [selected, setSelected] = useState<string | null>(profile.primaryQualificationId ?? suggested);
  const [savedAt, setSavedAt] = useState<number>();
  const save = useSave();

  function submit(e: FormEvent) {
    e.preventDefault();
    save.run(
      () => saveQualification({ qualificationId: selected }, { advanceTo: host.advanceTo }),
      () => {
        onSaved({ primaryQualificationId: selected });
        setSavedAt(Date.now());
        host.onDone?.();
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <Heading host={host} title={host.variant === "onboarding" ? "Which qualification?" : "Main qualification"}>
        {host.variant === "onboarding"
          ? "This is the default for your subjects. If one subject is different — say an AS level — you can change it in a moment."
          : "New subjects start on this qualification. Each subject's own qualification is set under Subjects and exam boards."}
      </Heading>
      {profile.educationLevel === "other" && host.variant === "onboarding" && (
        <Notice className="mb-5">
          Lumio teaches GCSE, International GCSE, AS and A-level today. Choose the closest one — more qualifications are
          on the way.
        </Notice>
      )}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {reference.qualifications.map((q) => (
          <ChoiceCard
            key={q.id}
            type="radio"
            name="qualification"
            checked={selected === q.id}
            onChange={() => setSelected(q.id)}
            icon={<GraduationCap className="size-[1.125rem]" aria-hidden />}
            title={
              <span className="flex items-center gap-2">
                {q.name}
                {q.id === suggested && <Badge tone="blue">Suggested</Badge>}
              </span>
            }
            description={`${(reference.boardsByQualification[q.id] ?? []).length} exam ${
              (reference.boardsByQualification[q.id] ?? []).length === 1 ? "board" : "boards"
            } available`}
          />
        ))}
      </div>
      {save.error?.fieldErrors?.qualificationId && (
        <p className="mt-2 text-[0.8125rem] text-danger">{save.error.fieldErrors.qualificationId}</p>
      )}
      <StepFooter
        host={host}
        pending={save.pending}
        error={save.error}
        onRetry={save.retry}
        savedAt={savedAt}
        disabled={!selected}
      />
    </form>
  );
}

// ---------------------------------------------------------------------------
// 3 · Subjects
// ---------------------------------------------------------------------------
export function SubjectsStep({
  host,
  reference,
  subjects,
  primaryQualificationId,
  onSaved,
}: {
  host: StepHost;
  reference: ReferenceData;
  subjects: StudentSubjectRow[];
  primaryQualificationId: string | null;
  onSaved: (rows: StudentSubjectRow[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(subjects.map((s) => s.subjectId));
  const [query, setQuery] = useState("");
  const [savedAt, setSavedAt] = useState<number>();
  const save = useSave();
  const searchId = useId();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? reference.subjects.filter((s) => s.name.toLowerCase().includes(q)) : reference.subjects;
  }, [query, reference.subjects]);
  const nameOf = (id: string) => reference.subjects.find((s) => s.id === id)?.name ?? "";
  const removingWithExams = host.variant === "settings" && subjects.some((s) => !selected.includes(s.subjectId));

  function toggle(id: string, on: boolean) {
    setSelected((prev) => (on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    save.run(
      () => saveSubjects({ subjectIds: selected }, { advanceTo: host.advanceTo }),
      () => {
        // Mirror the server: keep existing rows, add new ones on the main qualification.
        const kept = subjects.filter((s) => selected.includes(s.subjectId));
        const added = selected
          .filter((id) => !subjects.some((s) => s.subjectId === id))
          .map<StudentSubjectRow>((subjectId) => ({
            id: `new-${subjectId}`,
            subjectId,
            qualificationId: primaryQualificationId ?? "",
            examBoardId: null,
            currentGrade: null,
            targetGrade: null,
            confidence: null,
          }));
        onSaved([...kept, ...added]);
        setSavedAt(Date.now());
        host.onDone?.();
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <Heading host={host} title={host.variant === "onboarding" ? "Pick your subjects" : "Subjects"}>
        {host.variant === "onboarding"
          ? "Choose every subject you're studying. You can change these whenever you like."
          : "Add or remove subjects."}
      </Heading>

      <div className="mb-5 flex min-h-11 flex-wrap items-center gap-2" aria-live="polite">
        {selected.length === 0 ? (
          <p className="text-sm text-fg-subtle">No subjects chosen yet.</p>
        ) : (
          <>
            <span className="mr-1 text-sm text-fg-muted">
              {selected.length} {selected.length === 1 ? "subject" : "subjects"}
            </span>
            <AnimatePresence initial={false}>
              {selected.map((id) => (
                <motion.span
                  key={id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-blue-500/15 pr-1 pl-3 text-[0.8125rem] text-fg ring-1 ring-blue-400/30"
                >
                  {nameOf(id)}
                  <button
                    type="button"
                    onClick={() => toggle(id, false)}
                    aria-label={`Remove ${nameOf(id)}`}
                    className="flex size-6 items-center justify-center rounded-full text-fg-muted hover:bg-white/10 hover:text-fg"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
          </>
        )}
      </div>

      <div className="relative mb-4 max-w-sm">
        <label htmlFor={searchId} className="sr-only">
          Search subjects
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-subtle"
          aria-hidden
        />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subjects"
          className="h-11 w-full rounded-control border border-line-strong bg-ink-900/70 pr-3 pl-10 text-[0.9375rem] outline-none placeholder:text-fg-subtle focus:border-blue-400/70"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
        {visible.map((s) => (
          <ChoiceCard
            key={s.id}
            type="checkbox"
            name="subjects"
            checked={selected.includes(s.id)}
            onChange={(on) => toggle(s.id, on)}
            title={s.name}
            icon={<BookMarked className="size-[1.125rem]" aria-hidden />}
            className="p-3"
          />
        ))}
        {visible.length === 0 && (
          <p className="col-span-full py-6 text-sm text-fg-subtle">
            No subjects match “{query}”. More subjects are added as the curriculum grows.
          </p>
        )}
      </div>
      {removingWithExams && (
        <Notice className="mt-5">Removing a subject also removes any exam dates saved for it.</Notice>
      )}
      <StepFooter
        host={host}
        pending={save.pending}
        error={save.error}
        onRetry={save.retry}
        savedAt={savedAt}
        disabled={selected.length === 0}
      />
    </form>
  );
}

// ---------------------------------------------------------------------------
// 4 · Exam boards (per subject)
// ---------------------------------------------------------------------------
const NOT_SURE = "not-sure";

export function BoardsStep({
  host,
  reference,
  subjects,
  onSaved,
}: {
  host: StepHost;
  reference: ReferenceData;
  subjects: StudentSubjectRow[];
  onSaved: (rows: StudentSubjectRow[]) => void;
}) {
  const [entries, setEntries] = useState(
    subjects.map((s) => ({ subjectId: s.subjectId, qualificationId: s.qualificationId, examBoardId: s.examBoardId })),
  );
  const [savedAt, setSavedAt] = useState<number>();
  const save = useSave();
  const errs = save.error?.fieldErrors ?? {};

  function update(subjectId: string, patch: Partial<(typeof entries)[number]>) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.subjectId !== subjectId) return e;
        const next = { ...e, ...patch };
        // Changing qualification clears a board that doesn't offer it.
        if (patch.qualificationId && next.examBoardId) {
          const offered = reference.boardsByQualification[patch.qualificationId] ?? [];
          if (!offered.includes(next.examBoardId)) next.examBoardId = null;
        }
        return next;
      }),
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    save.run(
      () => saveBoards({ entries }, { advanceTo: host.advanceTo }),
      () => {
        onSaved(
          subjects.map((s) => {
            const entry = entries.find((x) => x.subjectId === s.subjectId)!;
            const level = reference.qualifications.find((q) => q.id === entry.qualificationId)?.level;
            return {
              ...s,
              ...entry,
              currentGrade: level && gradeIsValid(level, s.currentGrade) ? s.currentGrade : null,
              targetGrade: level && gradeIsValid(level, s.targetGrade) ? s.targetGrade : null,
            };
          }),
        );
        setSavedAt(Date.now());
        host.onDone?.();
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <Heading host={host} title={host.variant === "onboarding" ? "Which exam boards?" : "Exam boards"}>
        Each subject can have its own board — Biology with AQA and Economics with Pearson Edexcel, for example. If
        you&apos;re not sure, ask your teacher or check a past paper; you can add it later.
      </Heading>
      <ul className="space-y-3">
        {entries.map((entry) => {
          const subject = reference.subjects.find((s) => s.id === entry.subjectId);
          const boards = (reference.boardsByQualification[entry.qualificationId] ?? [])
            .map((id) => reference.examBoards.find((b) => b.id === id))
            .filter((b): b is NonNullable<typeof b> => Boolean(b));
          return (
            <li key={entry.subjectId} className="rounded-panel border border-line bg-ink-900/40 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-base font-semibold">{subject?.name}</h3>
                <label className="flex items-center gap-2 text-[0.8125rem] text-fg-muted">
                  <span>Qualification</span>
                  <select
                    value={entry.qualificationId}
                    onChange={(e) => update(entry.subjectId, { qualificationId: e.target.value })}
                    className="h-9 rounded-control border border-line-strong bg-ink-850 px-2.5 text-[0.8125rem] text-fg outline-none focus:border-blue-400/70"
                  >
                    {reference.qualifications.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-4">
                <ChipGroup
                  size="sm"
                  label={`Exam board for ${subject?.name ?? "this subject"}`}
                  options={[
                    ...boards.map((b) => ({ value: b.id, label: b.name })),
                    { value: NOT_SURE, label: "Not sure yet" },
                  ]}
                  value={entry.examBoardId ?? NOT_SURE}
                  onChange={(v) => update(entry.subjectId, { examBoardId: v === NOT_SURE || v === null ? null : v })}
                  error={errs[entry.subjectId]}
                />
                {boards.length === 1 && (
                  <p className="mt-2 text-xs text-fg-subtle">
                    Of the boards Lumio supports, only {boards[0].name} offers this qualification.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <StepFooter host={host} pending={save.pending} error={save.error} onRetry={save.retry} savedAt={savedAt} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// 5 · Goals and grades (all optional)
// ---------------------------------------------------------------------------
export function GoalsStep({
  host,
  reference,
  subjects,
  academicGoals,
  onSaved,
}: {
  host: StepHost;
  reference: ReferenceData;
  subjects: StudentSubjectRow[];
  academicGoals: string | null;
  onSaved: (rows: StudentSubjectRow[], goals: string | null) => void;
}) {
  const [entries, setEntries] = useState(
    subjects.map((s) => ({
      subjectId: s.subjectId,
      currentGrade: s.currentGrade,
      targetGrade: s.targetGrade,
      confidence: s.confidence,
    })),
  );
  const [goals, setGoals] = useState(academicGoals ?? "");
  const [savedAt, setSavedAt] = useState<number>();
  const save = useSave();
  const errs = save.error?.fieldErrors ?? {};
  const goalsId = useId();

  function update(subjectId: string, patch: Partial<(typeof entries)[number]>) {
    setEntries((prev) => prev.map((e) => (e.subjectId === subjectId ? { ...e, ...patch } : e)));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    save.run(
      () => saveGoals({ entries, academicGoals: goals }, { advanceTo: host.advanceTo }),
      () => {
        onSaved(
          subjects.map((s) => ({ ...s, ...entries.find((x) => x.subjectId === s.subjectId)! })),
          goals.trim() || null,
        );
        setSavedAt(Date.now());
        host.onDone?.();
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <Heading
        host={host}
        title={host.variant === "onboarding" ? "Where you are, where you're aiming" : "Grades and goals"}
      >
        Everything here is optional. Leave grades blank if you don&apos;t know them — your tutor will work them out with
        you.
      </Heading>
      <ul className="space-y-3">
        {entries.map((entry) => {
          const row = subjects.find((s) => s.subjectId === entry.subjectId)!;
          const qualification = reference.qualifications.find((q) => q.id === row.qualificationId);
          const scale = qualification ? GRADE_SCALES[qualification.level] : [];
          const name = reference.subjects.find((s) => s.id === entry.subjectId)?.name ?? "";
          return (
            <li key={entry.subjectId} className="rounded-panel border border-line bg-ink-900/40 p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-base font-semibold">{name}</h3>
                <span className="text-xs text-fg-subtle">{qualification?.name}</span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <GradeSelect
                  label="Current grade"
                  scale={scale}
                  value={entry.currentGrade}
                  onChange={(v) => update(entry.subjectId, { currentGrade: v })}
                />
                <GradeSelect
                  label="Target grade"
                  scale={scale}
                  value={entry.targetGrade}
                  onChange={(v) => update(entry.subjectId, { targetGrade: v })}
                />
              </div>
              <div className="mt-4">
                <ChipGroup<Confidence>
                  size="sm"
                  label="How does it feel at the moment?"
                  options={CONFIDENCE_OPTIONS}
                  value={entry.confidence}
                  onChange={(v) => update(entry.subjectId, { confidence: v })}
                  allowDeselect
                />
              </div>
              {errs[entry.subjectId] && <p className="mt-2 text-[0.8125rem] text-danger">{errs[entry.subjectId]}</p>}
            </li>
          );
        })}
      </ul>
      <div className="mt-6 flex flex-col gap-2">
        <label htmlFor={goalsId} className="text-sm font-medium">
          Your main goals <span className="font-normal text-fg-subtle">(optional)</span>
        </label>
        <textarea
          id={goalsId}
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          maxLength={600}
          rows={3}
          placeholder="For example: get an A in Chemistry for a medicine offer, or stop panicking in maths exams."
          aria-invalid={errs.academicGoals ? true : undefined}
          className="w-full rounded-control border border-line-strong bg-ink-900/70 px-4 py-3 text-[0.9375rem] leading-relaxed outline-none placeholder:text-fg-subtle focus:border-blue-400/70"
        />
        <p className="text-right text-xs text-fg-subtle tabular-nums">{goals.length}/600</p>
        {errs.academicGoals && <p className="text-[0.8125rem] text-danger">{errs.academicGoals}</p>}
      </div>
      <StepFooter host={host} pending={save.pending} error={save.error} onRetry={save.retry} savedAt={savedAt} />
    </form>
  );
}

function GradeSelect({
  label,
  scale,
  value,
  onChange,
}: {
  label: string;
  scale: readonly string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.8125rem] font-medium text-fg-muted">
        {label} <span className="font-normal text-fg-subtle">(optional)</span>
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-11 rounded-control border border-line-strong bg-ink-850 px-3 text-[0.9375rem] text-fg outline-none focus:border-blue-400/70"
      >
        <option value="">Not sure</option>
        {scale.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7 · Learning preferences
// ---------------------------------------------------------------------------
const PREFERENCE_ICONS: Record<LearningPreference, React.ReactNode> = {
  visual: <Eye className="size-[1.125rem]" aria-hidden />,
  conversational: <MessagesSquare className="size-[1.125rem]" aria-hidden />,
  detailed: <ListTree className="size-[1.125rem]" aria-hidden />,
  simplified: <Feather className="size-[1.125rem]" aria-hidden />,
  example_based: <Lightbulb className="size-[1.125rem]" aria-hidden />,
  question_led: <CircleHelp className="size-[1.125rem]" aria-hidden />,
};

export function PreferencesStep({
  host,
  preferences,
  onSaved,
}: {
  host: StepHost;
  preferences: LearningPreference[];
  onSaved: (p: LearningPreference[]) => void;
}) {
  const [selected, setSelected] = useState<LearningPreference[]>(preferences);
  const [savedAt, setSavedAt] = useState<number>();
  const save = useSave();

  function submit(e: FormEvent) {
    e.preventDefault();
    save.run(
      () => savePreferences({ preferences: selected }, { advanceTo: host.advanceTo }),
      () => {
        onSaved(selected);
        setSavedAt(Date.now());
        host.onDone?.();
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <Heading host={host} title={host.variant === "onboarding" ? "How do you like to learn?" : "How you learn"}>
        Choose as many as you like. Your tutor uses these as a starting point and adapts as it gets to know you.
      </Heading>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {LEARNING_PREFERENCES.map((p) => (
          <ChoiceCard
            key={p.value}
            type="checkbox"
            name="preferences"
            checked={selected.includes(p.value)}
            onChange={(on) => setSelected((prev) => (on ? [...prev, p.value] : prev.filter((x) => x !== p.value)))}
            icon={PREFERENCE_ICONS[p.value]}
            title={p.label}
            description={p.description}
          />
        ))}
      </div>
      <StepFooter
        host={host}
        pending={save.pending}
        error={save.error}
        onRetry={save.retry}
        savedAt={savedAt}
        disabled={selected.length === 0}
      />
    </form>
  );
}

/** Tiny helper used by subject-dependent steps when no subjects exist yet. */
export function NeedsSubjects({ className }: { className?: string }) {
  return (
    <p className={cn("rounded-panel border border-line bg-ink-900/40 p-5 text-sm text-fg-muted", className)}>
      Add your subjects first — then you can set exam boards, grades and exam dates for each one.
    </p>
  );
}
