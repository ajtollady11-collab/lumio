import { CalendarDays, Link2, ShieldCheck } from "lucide-react";
import { InviteChildButton, PendingInvitations } from "@/components/family/parent-linking";
import { ServiceUnavailable } from "@/components/feedback/service-unavailable";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { requireViewer } from "@/lib/auth/session";
import { EDUCATION_LEVELS, SCHOOL_YEARS, labelFor } from "@/lib/onboarding/options";
import { londonToday } from "@/lib/onboarding/schemas";
import { tryGetReferenceData } from "@/server/curriculum/reference";
import { getParentHome, type LinkedChild } from "@/server/family/data";
import type { ReferenceData } from "@/server/curriculum/reference";

/*
 * Parent home (foundation). Shows linked children from real data only.
 * Analytics, activity timelines and reports arrive in Phase 6.
 */
export default async function ParentHome() {
  const viewer = await requireViewer("/parent");
  const [home, reference] = await Promise.all([getParentHome(viewer.id, londonToday()), tryGetReferenceData()]);
  if (!home || !reference) return <ServiceUnavailable />;

  const name = home.firstName ?? viewer.displayName ?? "there";

  if (home.children.length === 0) {
    return (
      <>
        <PageHeader
          title={`Hello, ${name}`}
          description="Link your child's account to start following their progress."
        />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="surface relative overflow-hidden rounded-stage p-6 sm:p-10">
            <div
              aria-hidden
              className="absolute -top-20 -right-20 size-72 rounded-full bg-[radial-gradient(circle,rgb(138_107_255/0.2),transparent_65%)]"
            />
            <div className="relative">
              <span className="flex size-12 items-center justify-center rounded-panel bg-blue-500/12 ring-1 ring-blue-400/25">
                <Link2 className="size-6 text-blue-400" aria-hidden />
              </span>
              <h2 className="mt-6 text-display-sm">No children linked yet</h2>
              <p className="mt-3 max-w-lg leading-relaxed text-fg-muted">
                Create a one-time code and give it to your child. They enter it in their Lumio account under Settings,
                then Family, and approve the link. You can link more than one child.
              </p>
              <div className="mt-7">
                <InviteChildButton returnTo="/parent" />
              </div>
            </div>
          </section>
          <WhatYouSee />
        </div>
        <div className="mt-4">
          <PendingInvitations invitations={home.invitations} returnTo="/parent" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Hello, ${name}`}
        description={
          home.children.length === 1 ? "Your linked child." : `Your ${home.children.length} linked children.`
        }
        actions={<InviteChildButton label="Link another child" variant="secondary" returnTo="/parent" />}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        {home.children.map((child) => (
          <ChildCard key={child.linkId} child={child} reference={reference} />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <PendingInvitations invitations={home.invitations} returnTo="/parent" />
        <p className="rounded-panel border border-line p-5 text-sm leading-relaxed text-fg-muted lg:col-start-2">
          Study time, results and weekly reports will appear here as your child uses Lumio. Nothing is estimated or
          filled in before then.
        </p>
      </div>
    </>
  );
}

function ChildCard({ child, reference }: { child: LinkedChild; reference: ReferenceData }) {
  const initial = child.name.charAt(0).toUpperCase();
  return (
    <article className="surface rounded-stage p-6">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 font-display text-lg font-semibold text-white"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold">{child.name}</h2>
          {child.sharing ? (
            <p className="mt-0.5 text-sm text-fg-muted">
              {[labelFor(EDUCATION_LEVELS, child.educationLevel), labelFor(SCHOOL_YEARS, child.schoolYear)]
                .filter(Boolean)
                .join(", ") || "Profile not finished yet"}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-fg-muted">{child.name} has paused sharing their study activity.</p>
          )}
        </div>
      </div>

      {child.sharing && (
        <>
          <div className="mt-6">
            <h3 className="text-sm text-fg-subtle">Subjects</h3>
            {child.subjects.length ? (
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {child.subjects.map((s) => {
                  const subject = reference.subjects.find((x) => x.id === s.subjectId)?.name;
                  const board = reference.examBoards.find((b) => b.id === s.examBoardId)?.name;
                  return (
                    <li key={s.subjectId}>
                      <Badge tone="neutral" className="h-7 px-3 text-[0.8125rem]">
                        {subject}
                        {board && <span className="text-fg-subtle">{board}</span>}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-fg-muted">No subjects added yet.</p>
            )}
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm text-fg-muted">
            <CalendarDays className="size-4 text-fg-subtle" aria-hidden />
            {child.upcomingExams
              ? `${child.upcomingExams} upcoming ${child.upcomingExams === 1 ? "exam" : "exams"} saved`
              : "No exam dates saved yet"}
          </p>
        </>
      )}
    </article>
  );
}

function WhatYouSee() {
  return (
    <section className="rounded-stage border border-line bg-ink-900/40 p-6 sm:p-8">
      <ShieldCheck className="size-5 text-cyan-400" aria-hidden />
      <h2 className="mt-4 font-display text-lg font-semibold">What you&apos;ll be able to see</h2>
      <ul className="mt-4 space-y-2.5 text-[0.9375rem] text-fg-muted">
        <li>Subjects, exam boards and upcoming exams</li>
        <li>Study time and lessons, as your child uses Lumio</li>
        <li>Quiz and exam-practice results</li>
        <li>A weekly written report (coming later)</li>
      </ul>
      <p className="mt-5 text-sm leading-relaxed text-fg-subtle">
        Your child controls what&apos;s shared. Conversations with their tutor stay private unless they choose to share
        them.
      </p>
    </section>
  );
}
