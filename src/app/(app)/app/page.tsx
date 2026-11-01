import { CalendarDays, Settings2 } from "lucide-react";
import Link from "next/link";
import { TutorOrb } from "@/components/brand/tutor-orb";
import { ServiceUnavailable } from "@/components/feedback/service-unavailable";
import { daysUntil, formatExamDate } from "@/lib/onboarding/dates";
import { STUDENT_NAV } from "@/components/shell/navigation";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth/session";
import { CONFIDENCE_OPTIONS, LEARNING_PREFERENCES, labelFor } from "@/lib/onboarding/options";
import { londonToday } from "@/lib/onboarding/schemas";
import { tryGetReferenceData } from "@/server/curriculum/reference";
import { getStudentSnapshot } from "@/server/onboarding/student-data";

/*
 * Student home. Shows only what the student has told Lumio (from onboarding).
 * Recommendations, progress and streaks need real learning activity and are
 * built in later phases — nothing here is estimated or invented.
 */
export default async function StudentHome() {
  const viewer = await requireViewer("/app");
  const [snapshot, reference] = await Promise.all([getStudentSnapshot(viewer.id), tryGetReferenceData()]);
  if (!snapshot || !reference) return <ServiceUnavailable />;

  const today = londonToday();
  const p = snapshot.profile;
  const upcoming = snapshot.exams.filter((e) => e.examDate >= today).slice(0, 4);
  const areas = STUDENT_NAV.groups.flatMap((g) => g.items).filter((i) => i.href !== STUDENT_NAV.home);
  const subjectName = (id: string) => reference.subjects.find((s) => s.id === id)?.name ?? "";

  return (
    <div className="space-y-8">
      <section className="surface relative overflow-hidden rounded-stage p-6 sm:p-10">
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(ellipse_at_80%_50%,rgb(59_123_255/0.16),transparent_65%)]"
        />
        <div className="relative flex flex-col-reverse items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h1 className="text-[2rem] leading-tight tracking-[-0.03em] sm:text-display-md">
              Hello, {p.firstName ?? viewer.displayName ?? "there"}
            </h1>
            <p className="mt-3 text-lg leading-relaxed text-fg-muted">
              Your learning profile is set up. Live lessons with your tutor are the next part of Lumio being built.
            </p>
            {p.parentalConsent === "pending" && (
              <p className="mt-4 text-sm text-warning">
                A parent or carer needs to link their account before your tutor can start teaching. They can create a
                code from their own Lumio account.
              </p>
            )}
          </div>
          <TutorOrb state="idle" size={120} label="Your tutor" />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section aria-labelledby="subjects-heading" className="surface rounded-stage p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="subjects-heading" className="font-display text-lg font-semibold">
              Your subjects
            </h2>
            <Link
              href="/app/settings#studies"
              className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
            >
              <Settings2 className="size-4" aria-hidden />
              Edit
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-line">
            {snapshot.subjects.map((s) => {
              const qual = reference.qualifications.find((q) => q.id === s.qualificationId)?.name;
              const board = reference.examBoards.find((b) => b.id === s.examBoardId)?.name;
              return (
                <li key={s.subjectId} className="flex flex-wrap items-center justify-between gap-2 py-3.5">
                  <div>
                    <p className="font-medium">{subjectName(s.subjectId)}</p>
                    <p className="text-sm text-fg-muted">
                      {qual}
                      {board ? `, ${board}` : ", exam board not set"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.currentGrade && <Badge>Now {s.currentGrade}</Badge>}
                    {s.targetGrade && <Badge tone="blue">Target {s.targetGrade}</Badge>}
                    {s.confidence && (
                      <Badge tone={s.confidence === "difficult" ? "violet" : "neutral"}>
                        {labelFor(CONFIDENCE_OPTIONS, s.confidence)}
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="exams-heading" className="surface rounded-stage p-6">
          <h2 id="exams-heading" className="font-display text-lg font-semibold">
            Upcoming exams
          </h2>
          {upcoming.length ? (
            <ul className="mt-4 space-y-3">
              {upcoming.map((e) => {
                const days = daysUntil(e.examDate, today);
                return (
                  <li key={e.id} className="flex items-center gap-4">
                    <div className="w-12 shrink-0 text-center">
                      <p className="font-display text-xl leading-none font-semibold tabular-nums">{days}</p>
                      <p className="mt-0.5 text-[0.6875rem] text-fg-subtle">{days === 1 ? "day" : "days"}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{subjectName(e.subjectId)}</p>
                      <p className="truncate text-sm text-fg-muted">
                        {formatExamDate(e.examDate)}
                        {e.notes ? `, ${e.notes}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-4">
              <p className="flex items-center gap-2 text-sm text-fg-muted">
                <CalendarDays className="size-4 text-fg-subtle" aria-hidden />
                No exam dates saved yet.
              </p>
              <ButtonLink href="/app/settings#exams" variant="secondary" size="sm" className="mt-4">
                Add exam dates
              </ButtonLink>
            </div>
          )}
          {p.learningPreferences.length > 0 && (
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-sm text-fg-subtle">How you like to learn</h3>
              <p className="mt-1.5 text-sm text-fg-muted">
                {p.learningPreferences.map((v) => LEARNING_PREFERENCES.find((x) => x.value === v)?.label).join(", ")}
              </p>
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="areas-heading">
        <h2 id="areas-heading" className="font-display text-xl font-semibold tracking-tight">
          Coming to Lumio
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {areas.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="group flex h-full flex-col rounded-panel border border-line bg-ink-900/40 p-5 transition-colors hover:border-line-strong hover:bg-ink-850/70"
                >
                  <Icon className="size-5 text-fg-subtle transition-colors group-hover:text-blue-400" aria-hidden />
                  <span className="mt-4 font-medium">{item.label}</span>
                  <span className="mt-1.5 text-sm leading-relaxed text-fg-muted">{item.description}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
