import { buildRecommendations } from "@/lib/recommendations/engine";
import {
  buildExams,
  buildGoalProgress,
  buildSubjects,
  EXAM_SOON_DAYS,
  greetingSummary,
  localHour,
  partOfDay,
  type ProfileLite,
  type ReferenceLite,
} from "@/lib/dashboard/model";
import type { DashboardActivity } from "@/lib/dashboard/types";
import { topicSignals, topicsBySubject, type LearningProfileRow } from "@/lib/learning/profile";
import { cn } from "@/lib/utils/cn";
import { Greeting } from "./greeting";
import { LearningSnapshot } from "./learning-snapshot";
import { LearningOverview } from "./learning-overview";
import { QuickActions } from "./quick-actions";
import { RecentActivity } from "./recent-activity";
import { Recommendations } from "./recommendations";
import { RevealGroup } from "./reveal";
import { StreakCard } from "./streak-card";
import { SubjectsOverview } from "./subjects-overview";
import { UpcomingExams } from "./upcoming-exams";
import { WeeklyGoals } from "./weekly-goals";

const WEEK_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * The student's home. Pure presentation over three inputs — saved profile,
 * curriculum names and tracked activity — so it renders identically in tests.
 *
 * Personalisation (all rule-based, from real data):
 *  • An exam within two weeks moves the exam panel up and highlights it.
 *  • No tracked learning yet → the greeting explains where figures come from.
 *  • Lapsed students get a "pick up where you left off" greeting + suggestion.
 * On phones the order is: greeting → what to do next → quick actions → exams
 * → subjects → goals → streak → overview → activity.
 */
export function StudentDashboard({
  displayName,
  profile,
  reference,
  activity,
  learning,
  now,
}: {
  displayName: string;
  profile: ProfileLite;
  reference: ReferenceLite;
  activity: DashboardActivity;
  /** Topic mastery + insights. Optional: without it the dashboard still renders, minus topic-level detail. */
  learning?: LearningProfileRow;
  now: Date;
}) {
  const subjects = buildSubjects(profile, reference, activity);
  const exams = buildExams(profile, reference, activity.today);
  const consentPending = profile.parentalConsent === "pending";
  const refs = subjects.map((s) => ({
    id: s.subjectId,
    slug: s.slug,
    name: s.name,
    accent: s.accent.hex,
    nextExamDays: s.nextExam?.days ?? null,
  }));
  const recommendations = buildRecommendations({
    today: activity.today,
    subjects,
    exams,
    activity,
    consentPending,
    topics: learning ? topicSignals(learning, refs) : undefined,
  });
  const topicCounts = learning
    ? Object.fromEntries(topicsBySubject(learning, refs).map((g) => [g.subject.id, g.counts]))
    : undefined;
  const examSoon = exams.some((e) => e.days <= EXAM_SOON_DAYS);
  const subjectName = (id: string | null) => (id ? (reference.subjects.find((s) => s.id === id)?.name ?? null) : null);
  const weekEnd = new Date(Date.parse(`${activity.weekStart}T00:00:00Z`) + 6 * 86_400_000);
  const weekLabel = `This week · ${WEEK_FMT.format(new Date(`${activity.weekStart}T00:00:00Z`))} – ${WEEK_FMT.format(weekEnd)}`;

  return (
    <RevealGroup className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <div className="order-1 lg:col-span-8">
        <Greeting
          name={profile.firstName ?? displayName}
          partOfDay={partOfDay(localHour(now, activity.timezone))}
          summary={greetingSummary({ subjects, exams, activity })}
          consentPending={consentPending}
          isNew={activity.totals.events === 0}
        />
      </div>
      <div className="order-7 lg:order-1 lg:col-span-4">
        <StreakCard activity={activity} />
      </div>

      <div className="order-3 lg:order-2 lg:col-span-12">
        <QuickActions />
      </div>

      <div className={cn("order-2 lg:col-span-7", examSoon ? "lg:order-4" : "lg:order-3")}>
        <Recommendations items={recommendations} />
      </div>
      <div className={cn("order-4 lg:col-span-5", examSoon ? "lg:order-3" : "lg:order-4")}>
        <UpcomingExams exams={exams} />
      </div>

      <div className="order-5 lg:col-span-12">
        <SubjectsOverview subjects={subjects} today={activity.today} topicCounts={topicCounts} />
      </div>

      {learning && (
        <div className="order-6 lg:order-5 lg:col-span-12">
          <LearningSnapshot learning={learning} subjectName={subjectName} today={activity.today} />
        </div>
      )}

      <div className="order-8 lg:order-6 lg:col-span-7">
        <LearningOverview activity={activity} subjectCount={subjects.length} />
      </div>
      <div className="order-6 lg:order-6 lg:col-span-5">
        <WeeklyGoals goals={activity.goals} progress={buildGoalProgress(activity)} weekLabel={weekLabel} />
      </div>

      <div className="order-9 lg:order-7 lg:col-span-12">
        <RecentActivity
          items={activity.recent}
          subjectName={subjectName}
          timeZone={activity.timezone}
          today={activity.today}
        />
      </div>
    </RevealGroup>
  );
}
