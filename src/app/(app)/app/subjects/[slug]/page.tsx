import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  LineChart,
  Pencil,
  Presentation,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { EmptyState, Panel } from "@/components/dashboard/panel";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { RevealGroup } from "@/components/dashboard/reveal";
import { lastStudiedLabel } from "@/components/dashboard/subject-card";
import { UpcomingExams } from "@/components/dashboard/upcoming-exams";
import { PageSkeleton } from "@/components/feedback/skeletons";
import { ServiceUnavailable } from "@/components/feedback/service-unavailable";
import { ButtonLink } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth/session";
import { buildExams, buildSubjects } from "@/lib/dashboard/model";
import { CONFIDENCE_OPTIONS, labelFor } from "@/lib/onboarding/options";
import { formatExamDate } from "@/lib/onboarding/dates";
import { tryGetReferenceData } from "@/server/curriculum/reference";
import { getDashboardActivity } from "@/server/dashboard/activity";
import { getSubjectActivity } from "@/server/dashboard/subject-activity";
import { getStudentSnapshot } from "@/server/onboarding/student-data";

export const metadata: Metadata = { title: "Subject" };

export default function SubjectPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Subject params={params} />
    </Suspense>
  );
}

async function Subject({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await requireViewer(`/app/subjects/${slug}`);
  const [snapshot, activity, reference] = await Promise.all([
    getStudentSnapshot(viewer.id),
    getDashboardActivity(),
    tryGetReferenceData(),
  ]);
  if (!snapshot || !activity || !reference) return <ServiceUnavailable />;

  const subjectRef = reference.subjects.find((s) => s.slug === slug);
  if (!subjectRef) notFound();

  const profile = { firstName: null, parentalConsent: "", subjects: snapshot.subjects, exams: snapshot.exams };
  const subject = buildSubjects(profile, reference, activity).find((s) => s.slug === slug);

  if (!subject) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <EmptyState
          icon={BookOpen}
          title={`${subjectRef.name} isn’t one of your subjects`}
          action={
            <ButtonLink href="/app/settings#studies" size="sm">
              Add it in Settings
            </ButtonLink>
          }
        >
          Add it to your studies and Lumio will track exams and progress for it.
        </EmptyState>
      </div>
    );
  }

  const exams = buildExams(profile, reference, activity.today).filter((e) => e.subjectId === subject.subjectId);
  const pastExams = snapshot.exams
    .filter((e) => e.subjectId === subject.subjectId && e.examDate < activity.today)
    .sort((a, b) => b.examDate.localeCompare(a.examDate));
  const recent = (await getSubjectActivity(subject.subjectId)) ?? [];

  return (
    <RevealGroup className="space-y-5">
      <Link href="/app/subjects" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        All subjects
      </Link>

      <header
        style={{ "--accent": subject.accent.hex, "--accent-soft": subject.accent.soft } as CSSProperties}
        className="surface relative isolate overflow-hidden rounded-stage p-6 sm:p-8"
      >
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_90%_20%,var(--accent-soft),transparent_60%)]"
        />
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[var(--accent)] to-transparent"
        />
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-fg-muted">
              {subject.qualificationName}
              {subject.boardName ? ` · ${subject.boardName}` : " · exam board not set"}
            </p>
            <h1 className="mt-1 font-display text-[2rem] leading-tight font-semibold tracking-[-0.03em] sm:text-display-md">
              {subject.name}
            </h1>
            <p className="mt-2 text-sm text-fg-subtle">{lastStudiedLabel(subject, activity.today)}</p>
          </div>
          <ButtonLink
            href="/app/settings#studies"
            variant="secondary"
            size="sm"
            icon={<Pencil className="size-3.5" aria-hidden />}
          >
            Edit grades & board
          </ButtonLink>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Target grade", subject.targetGrade ?? "Not set"],
            ["Current grade", subject.currentGrade ?? "Not set"],
            ["How it feels", subject.confidence ? labelFor(CONFIDENCE_OPTIONS, subject.confidence) : "Not set"],
            [
              "Performance",
              subject.performance
                ? `${Math.round(subject.performance.averagePercent)}% avg of ${subject.performance.assessedCount}`
                : "Not assessed yet",
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-panel border border-line bg-ink-900/40 p-3.5">
              <dt className="text-[0.75rem] text-fg-subtle">{label}</dt>
              <dd className="mt-1 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Panel id="topics" title="Topics" icon={BookOpen}>
            <EmptyState icon={LineChart} title="Topic tracking starts with lessons">
              When lessons launch, every topic in your {subject.boardName ? `${subject.boardName} ` : ""}
              {subject.qualificationName} {subject.name} specification will appear here, marked as completed or needing
              attention from your actual results.
            </EmptyState>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <Link
                href="/app/lessons"
                className="flex items-center justify-between gap-3 rounded-panel border border-line p-4 text-sm hover:border-line-strong"
              >
                <span className="flex items-center gap-2.5">
                  <Presentation className="size-4 text-fg-subtle" aria-hidden />
                  Start a {subject.name} lesson
                </span>
                <span className="text-xs text-violet-400">Soon</span>
              </Link>
              <Link
                href={`/app/tutor?subject=${subject.slug}`}
                className="flex items-center justify-between gap-3 rounded-panel border border-blue-400/25 bg-blue-500/[0.07] p-4 text-sm hover:border-blue-400/50"
              >
                <span className="flex items-center gap-2.5">
                  <Sparkles className="size-4 text-blue-400" aria-hidden />
                  Ask your tutor about {subject.name}
                </span>
              </Link>
            </div>
          </Panel>
        </div>
        <div id="exams" className="scroll-mt-24 lg:col-span-5">
          {exams.length ? (
            <UpcomingExams exams={exams} limit={10} />
          ) : (
            <Panel id="subject-exams" title="Exams" icon={CalendarDays}>
              <EmptyState
                icon={CalendarPlus}
                title={`No upcoming ${subject.name} exams`}
                action={
                  <ButtonLink href="/app/settings#exams" variant="secondary" size="sm">
                    Add an exam date
                  </ButtonLink>
                }
              />
            </Panel>
          )}
          {pastExams.length > 0 && (
            <p className="mt-3 px-1 text-[0.8125rem] text-fg-subtle">
              Past: {pastExams.map((e) => `${formatExamDate(e.examDate)}${e.notes ? ` (${e.notes})` : ""}`).join(" · ")}
            </p>
          )}
        </div>
      </div>

      <RecentActivity items={recent} subjectName={() => null} timeZone={activity.timezone} today={activity.today} />
    </RevealGroup>
  );
}
