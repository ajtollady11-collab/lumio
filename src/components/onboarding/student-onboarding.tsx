"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TutorOrb } from "@/components/brand/tutor-orb";
import { easings } from "@/components/motion/presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AGE_BANDS, CONFIDENCE_OPTIONS, LEARNING_PREFERENCES, SCHOOL_YEARS, labelFor } from "@/lib/onboarding/options";
import { STUDENT_STEPS, furthestAllowedStep, type StudentStepId } from "@/lib/onboarding/steps";
import { cn } from "@/lib/utils/cn";
import type { ReferenceData } from "@/server/curriculum/reference";
import { completeStudentOnboarding } from "@/server/onboarding/student-actions";
import type { StudentSnapshot } from "@/server/onboarding/student-data";
import { ExamsManager } from "./exams-manager";
import { SaveError } from "./save-error";
import type { StepHost } from "./step-frame";
import { AboutStep, BoardsStep, GoalsStep, PreferencesStep, QualificationStep, SubjectsStep } from "./steps";
import { useSave } from "./use-save";

const VISIBLE_STEPS = STUDENT_STEPS.filter((s) => s.id < 8);

/**
 * The student onboarding flow. Each step saves to Supabase before moving on;
 * the server decides where a returning student resumes and the database
 * decides when onboarding is complete.
 */
export function StudentOnboarding({
  initialStep,
  snapshot,
  reference,
  today,
}: {
  initialStep: StudentStepId;
  snapshot: StudentSnapshot;
  reference: ReferenceData;
  today: string;
}) {
  const [data, setData] = useState(snapshot);
  const [step, setStep] = useState<StudentStepId>(initialStep);
  const [direction, setDirection] = useState(1);
  const reduce = useReducedMotion();
  const topRef = useRef<HTMLDivElement>(null);

  const facts = {
    aboutComplete: Boolean(
      data.profile.firstName && data.profile.ageBand && data.profile.schoolYear && data.profile.educationLevel,
    ),
    hasQualification: Boolean(data.profile.primaryQualificationId),
    subjectCount: data.subjects.length,
    hasPreferences: data.profile.learningPreferences.length > 0,
    recordedStep: Math.max(data.profile.onboardingStep, step),
  };
  const allowed = furthestAllowedStep(facts);

  function go(to: number) {
    const target = Math.min(Math.max(to, 1), 8) as StudentStepId;
    setDirection(target > step ? 1 : -1);
    setStep(target);
    setData((d) => ({ ...d, profile: { ...d.profile, onboardingStep: Math.max(d.profile.onboardingStep, target) } }));
  }

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    const heading = topRef.current?.parentElement?.querySelector("h2");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  }, [step, reduce]);

  const host = (n: number): StepHost => ({
    variant: "onboarding",
    advanceTo: n + 1,
    onBack: n > 1 ? () => go(n - 1) : undefined,
    onDone: () => go(n + 1),
    returnTo: "/onboarding",
  });
  const patchProfile = (p: Partial<StudentSnapshot["profile"]>) =>
    setData((d) => ({ ...d, profile: { ...d.profile, ...p } }));

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
      <Progress step={step} allowed={allowed} onSelect={go} />

      <div className="min-w-0">
        <div ref={topRef} className="scroll-mt-24" />
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: direction * 28 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.38, ease: easings.outExpo } }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: direction * -20, transition: { duration: 0.18 } }}
          >
            {step === 1 && <AboutStep host={host(1)} profile={data.profile} onSaved={patchProfile} />}
            {step === 2 && (
              <QualificationStep host={host(2)} profile={data.profile} reference={reference} onSaved={patchProfile} />
            )}
            {step === 3 && (
              <SubjectsStep
                host={host(3)}
                reference={reference}
                subjects={data.subjects}
                primaryQualificationId={data.profile.primaryQualificationId}
                onSaved={(subjects) =>
                  setData((d) => ({
                    ...d,
                    subjects,
                    exams: d.exams.filter((e) => subjects.some((s) => s.subjectId === e.subjectId)),
                  }))
                }
              />
            )}
            {step === 4 && (
              <BoardsStep
                host={host(4)}
                reference={reference}
                subjects={data.subjects}
                onSaved={(subjects) => setData((d) => ({ ...d, subjects }))}
              />
            )}
            {step === 5 && (
              <GoalsStep
                host={host(5)}
                reference={reference}
                subjects={data.subjects}
                academicGoals={data.profile.academicGoals}
                onSaved={(subjects, academicGoals) =>
                  setData((d) => ({ ...d, subjects, profile: { ...d.profile, academicGoals } }))
                }
              />
            )}
            {step === 6 && (
              <ExamsManager
                host={host(6)}
                reference={reference}
                subjects={data.subjects}
                exams={data.exams}
                today={today}
                onChange={(exams) => setData((d) => ({ ...d, exams }))}
              />
            )}
            {step === 7 && (
              <PreferencesStep
                host={host(7)}
                preferences={data.profile.learningPreferences}
                onSaved={(learningPreferences) => patchProfile({ learningPreferences })}
              />
            )}
            {step === 8 && <CompleteStep data={data} reference={reference} onBack={() => go(7)} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Progress({ step, allowed, onSelect }: { step: number; allowed: number; onSelect: (n: number) => void }) {
  const current = Math.min(step, 7);
  const pct = step >= 8 ? 100 : ((current - 1) / VISIBLE_STEPS.length) * 100;

  return (
    <nav aria-label="Setup progress">
      {/* Phone and tablet: compact bar */}
      <div className="lg:hidden">
        <div className="mb-2.5 flex items-baseline justify-between text-sm">
          <span className="font-medium">{step >= 8 ? "All set" : VISIBLE_STEPS[current - 1].title}</span>
          <span className="text-fg-subtle tabular-nums">
            {step >= 8 ? "Done" : `Step ${current} of ${VISIBLE_STEPS.length}`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
            initial={false}
            animate={{ width: `${Math.max(pct, 4)}%` }}
            transition={{ duration: 0.5, ease: easings.outExpo }}
          />
        </div>
      </div>

      {/* Desktop: the full sequence */}
      <ol className="hidden lg:sticky lg:top-28 lg:block">
        {VISIBLE_STEPS.map((s, i) => {
          const state = s.id < step ? "done" : s.id === step ? "current" : "upcoming";
          const reachable = s.id <= allowed && s.id !== step;
          return (
            <li key={s.id} className="relative pb-1">
              {i < VISIBLE_STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-9 left-[1.0625rem] h-[calc(100%-1.75rem)] w-px",
                    state === "done" ? "bg-blue-400/50" : "bg-line-strong",
                  )}
                />
              )}
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(s.id)}
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-control px-1.5 py-2 text-left text-sm transition-colors",
                  reachable && "hover:bg-white/[0.04]",
                  !reachable && state !== "current" && "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors",
                    state === "done" && "bg-blue-500 text-white",
                    state === "current" && "bg-cyan-400/15 text-cyan-400 ring-1 ring-cyan-400/60",
                    state === "upcoming" && "bg-white/[0.05] text-fg-subtle",
                  )}
                >
                  {state === "done" ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : s.id}
                </span>
                <span className={cn(state === "upcoming" ? "text-fg-subtle" : "text-fg")}>
                  {s.title}
                  {s.optional && <span className="ml-1.5 text-xs text-fg-subtle">optional</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function CompleteStep({
  data,
  reference,
  onBack,
}: {
  data: StudentSnapshot;
  reference: ReferenceData;
  onBack: () => void;
}) {
  const router = useRouter();
  const save = useSave();
  const p = data.profile;
  const qualification = reference.qualifications.find((q) => q.id === p.primaryQualificationId)?.name;

  function enter() {
    save.run(completeStudentOnboarding, () => {
      router.replace("/app");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <TutorOrb state="speaking" size={96} label="Your tutor is ready" />
        <div>
          <h2 className="text-[1.75rem] leading-tight tracking-[-0.025em] sm:text-display-md">
            You&apos;re all set, {p.firstName}
          </h2>
          <p className="mt-2 max-w-lg leading-relaxed text-fg-muted">
            Here&apos;s what your tutor now knows about you. Everything can be changed later in Settings.
          </p>
        </div>
      </div>

      <dl className="surface mt-8 divide-y divide-line rounded-stage">
        <SummaryRow label="You">
          {[labelFor(AGE_BANDS, p.ageBand), labelFor(SCHOOL_YEARS, p.schoolYear)].filter(Boolean).join(", ")}
        </SummaryRow>
        <SummaryRow label="Qualification">{qualification ?? "Not chosen"}</SummaryRow>
        <SummaryRow label="Subjects">
          <ul className="space-y-2">
            {data.subjects.map((s) => {
              const name = reference.subjects.find((x) => x.id === s.subjectId)?.name;
              const board = reference.examBoards.find((b) => b.id === s.examBoardId)?.name;
              const qual = reference.qualifications.find((q) => q.id === s.qualificationId)?.name;
              return (
                <li key={s.subjectId} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{name}</span>
                  <span className="text-fg-muted">
                    {qual}
                    {board ? `, ${board}` : ", board not chosen yet"}
                  </span>
                  {s.targetGrade && <Badge tone="blue">Target {s.targetGrade}</Badge>}
                  {s.confidence && <Badge>{labelFor(CONFIDENCE_OPTIONS, s.confidence)}</Badge>}
                </li>
              );
            })}
          </ul>
        </SummaryRow>
        <SummaryRow label="Exams">{data.exams.length ? `${data.exams.length} saved` : "None added yet"}</SummaryRow>
        <SummaryRow label="How you learn">
          {p.learningPreferences.map((v) => LEARNING_PREFERENCES.find((x) => x.value === v)?.label).join(", ")}
        </SummaryRow>
      </dl>

      <div className="mt-8 space-y-4">
        <SaveError error={save.error} onRetry={save.retry} returnTo="/onboarding" />
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button type="button" size="lg" className="ml-auto" loading={save.pending} onClick={enter}>
            Go to my dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 px-5 py-4 sm:grid-cols-[9rem_1fr] sm:px-6">
      <dt className="text-sm text-fg-subtle">{label}</dt>
      <dd className="text-[0.9375rem]">{children}</dd>
    </div>
  );
}
