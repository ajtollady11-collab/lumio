import { ArrowRight, Brain, Lightbulb, Sparkles, Target, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import { EmptyState, Panel } from "@/components/dashboard/panel";
import { Recommendations } from "@/components/dashboard/recommendations";
import { RevealGroup } from "@/components/dashboard/reveal";
import { ButtonLink } from "@/components/ui/button";
import type { ExamSummary, SubjectSummary } from "@/lib/dashboard/model";
import type { DashboardActivity } from "@/lib/dashboard/types";
import { MASTERY_LEVELS, type MasteryLevel } from "@/lib/learning/levels";
import {
  areasToImprove,
  learningPatterns,
  manageableInsights,
  recentImprovements,
  strengths,
  topicSignals,
  topicsBySubject,
  type InsightRow,
  type LearningProfileRow,
  type SubjectRef,
} from "@/lib/learning/profile";
import { LEARNING_PREFERENCES } from "@/lib/onboarding/options";
import { buildRecommendations, examRule, LEARNING_RULES, tutorHref } from "@/lib/recommendations/engine";
import { optionFor, TEACHING_STYLES, type TeachingStyle } from "@/lib/tutor/options";
import { MemoryManager } from "./memory-manager";
import { SubjectTopicList } from "./topic-mastery";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
const lvl = (n: number) => MASTERY_LEVELS[Math.min(6, Math.max(1, n)) as MasteryLevel];

export const subjectRefs = (subjects: SubjectSummary[]): SubjectRef[] =>
  subjects.map((s) => ({
    id: s.subjectId,
    slug: s.slug,
    name: s.name,
    accent: s.accent.hex,
    nextExamDays: s.nextExam?.days ?? null,
  }));

/**
 * "My Learning Profile". Pure presentation over stored data: every count is a
 * count of rows, every level comes from private.recompute_mastery, and
 * nothing is shown as a percentage. Parents never reach this page (student
 * route; the RPC refuses non-students; RLS has no parent policy).
 */
export function LearningProfile({
  profile,
  subjects,
  exams,
  activity,
  tutor,
  learningPreferences,
}: {
  profile: LearningProfileRow;
  subjects: SubjectSummary[];
  exams: ExamSummary[];
  activity: Pick<DashboardActivity, "today" | "totals" | "goals">;
  tutor: { name: string; teachingStyle: TeachingStyle };
  learningPreferences: string[];
}) {
  const refs = subjectRefs(subjects);
  const groups = topicsBySubject(profile, refs);
  const nameOf = (id: string | null) => (id ? (refs.find((s) => s.id === id)?.name ?? null) : null);
  const slugOf = (id: string | null) => (id ? (refs.find((s) => s.id === id)?.slug ?? null) : null);
  const tracked = groups.reduce((n, g) => n + g.counts.tracked, 0);
  const strong = groups.reduce((n, g) => n + g.counts.strong, 0);
  const improve = areasToImprove(profile);
  const strong_ = strengths(profile);
  const patterns = learningPatterns(profile);
  const improvements = recentImprovements(profile, new Date(`${activity.today}T12:00:00Z`));
  const isEmpty = profile.mastery.length === 0 && profile.insights.length === 0;

  const nextSteps = buildRecommendations(
    { today: activity.today, subjects, exams, activity, consentPending: false, topics: topicSignals(profile, refs) },
    [...LEARNING_RULES, examRule],
    5,
    { perSubject: 2, perKind: 2 },
  );

  return (
    <RevealGroup className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <div className="lg:col-span-12">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat term="Topics tracked" value={tracked} icon={Target} />
          <Stat term="Questions answered" value={profile.questionsAnswered} icon={Sparkles} />
          <Stat term="Strong or mastered" value={strong} icon={Trophy} />
          <Stat term="Areas to improve" value={improve.filter((i) => i.kind === "weakness").length} icon={Lightbulb} />
        </dl>
      </div>

      {isEmpty && (
        <div className="lg:col-span-12">
          <Panel id="getting-started" title="Your profile starts with your first answers" icon={Brain}>
            <EmptyState
              icon={Sparkles}
              title="Nothing recorded yet"
              action={
                <ButtonLink href="/app/tutor" size="sm">
                  Start with {tutor.name}
                </ButtonLink>
              }
            >
              Pick a subject and topic with {tutor.name} and answer a few questions. Each answer is recorded against
              that topic; after several, you’ll see a level, your strengths and what to work on. Asking questions on its
              own never counts against you.
            </EmptyState>
          </Panel>
        </div>
      )}

      <div className="lg:col-span-7">
        <Recommendations
          id="profile-next"
          title="Recommended next steps"
          items={nextSteps}
          emptyText={
            isEmpty
              ? "Suggestions appear once you’ve answered questions on a few topics."
              : "Nothing pressing — keep going with your current topics."
          }
        />
      </div>

      <div className="lg:col-span-5">
        <Panel id="improvements" title="Recent improvements" icon={TrendingUp}>
          {improvements.length === 0 ? (
            <p className="text-sm leading-relaxed text-fg-muted">
              When a topic moves up a level, it shows here with the date it happened.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {improvements.slice(0, 5).map((c) => (
                <li key={`${c.subjectId}:${c.topicKey}`} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.topic}</span>
                    <span className="text-fg-subtle">
                      {nameOf(c.subjectId)} · {lvl(c.fromLevel).short} → {lvl(c.toLevel).short}
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.8125rem] text-fg-subtle tabular-nums">
                    {DATE.format(new Date(c.changedAt))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="lg:col-span-6">
        <Panel id="to-improve" title="Areas to improve" icon={Lightbulb}>
          {improve.length === 0 ? (
            <p className="text-sm leading-relaxed text-fg-muted">
              None recorded. A topic only appears here after several answers on it show a gap — never from one slip.
            </p>
          ) : (
            <InsightList items={improve.slice(0, 6)} nameOf={nameOf} slugOf={slugOf} cta="Practise" />
          )}
        </Panel>
      </div>

      <div className="lg:col-span-6">
        <Panel id="strengths" title="Strengths" icon={Trophy}>
          {strong_.length === 0 ? (
            <p className="text-sm leading-relaxed text-fg-muted">
              None yet. A topic becomes a strength at “Strong” — at least four answers, most of them right.
            </p>
          ) : (
            <InsightList items={strong_.slice(0, 6)} nameOf={nameOf} slugOf={slugOf} cta="Stretch yourself" />
          )}
        </Panel>
      </div>

      <div className="lg:col-span-12">
        <Panel id="how-you-learn" title="How you learn best" icon={Sparkles}>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-[0.75rem] font-medium tracking-wide text-fg-subtle uppercase">What you told us</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {learningPreferences.length === 0 ? (
                  <li className="text-sm text-fg-muted">No preferences chosen.</li>
                ) : (
                  learningPreferences.map((p) => (
                    <li
                      key={p}
                      className="inline-flex h-7 items-center rounded-full bg-white/[0.05] px-3 text-sm text-fg-muted ring-1 ring-line-strong ring-inset"
                    >
                      {LEARNING_PREFERENCES.find((x) => x.value === p)?.label ?? p}
                    </li>
                  ))
                )}
              </ul>
              <p className="mt-3 text-sm text-fg-muted">
                {tutor.name} teaches in a{" "}
                <span className="text-fg">{optionFor(TEACHING_STYLES, tutor.teachingStyle).label.toLowerCase()}</span>{" "}
                style.{" "}
                <Link href="/app/tutor/settings" className="text-blue-400 hover:text-blue-300">
                  Change
                </Link>
              </p>
            </div>
            <div>
              <p className="text-[0.75rem] font-medium tracking-wide text-fg-subtle uppercase">
                What’s worked in your sessions
              </p>
              {patterns.length === 0 ? (
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                  Not enough yet. When the same kind of explanation helps you get an answer right at least twice, it
                  shows here.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {patterns.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3 text-sm">
                      <span>{p.topic}</span>
                      <span className="text-fg-subtle tabular-nums">helped {p.occurrences} times</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>
      </div>

      <div className="lg:col-span-12">
        <Panel id="mastery" title="Topic mastery" icon={Target}>
          {groups.length === 0 ? (
            <p className="text-sm text-fg-muted">Add subjects in Settings to track topics.</p>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => (
                <SubjectTopicList key={g.subject.id} group={g} />
              ))}
            </div>
          )}
          <details className="group mt-4 rounded-panel border border-line px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium text-fg-muted marker:text-fg-subtle hover:text-fg">
              How levels are worked out
            </summary>
            <p className="mt-3 leading-relaxed text-fg-muted">
              Levels come only from your answers — never from time spent. Recent answers count more than old ones, and
              harder questions count a little more. You need at least two answers before a topic gets a level.
            </p>
            <ol className="mt-3 space-y-1.5">
              {([2, 3, 4, 5, 6] as MasteryLevel[]).map((l) => (
                <li key={l} className="grid grid-cols-[7.5rem_1fr] gap-3">
                  <span className="font-medium">{MASTERY_LEVELS[l].short}</span>
                  <span className="text-fg-muted">{MASTERY_LEVELS[l].meaning}</span>
                </li>
              ))}
            </ol>
          </details>
        </Panel>
      </div>

      <div className="lg:col-span-12">
        <Panel id="memory" title={`What ${tutor.name} remembers`} icon={Brain}>
          <MemoryManager
            insights={manageableInsights(profile)}
            subjectNames={Object.fromEntries(refs.map((r) => [r.id, r.name]))}
            tutorName={tutor.name}
            hasAnyData={!isEmpty}
          />
        </Panel>
      </div>
    </RevealGroup>
  );
}

function Stat({ term, value, icon: Icon }: { term: string; value: number; icon: typeof Target }) {
  return (
    <div className="surface rounded-stage p-4">
      <dt className="flex items-center gap-2 text-[0.8125rem] text-fg-subtle">
        <Icon className="size-4" aria-hidden />
        {term}
      </dt>
      <dd className="mt-1.5 font-display text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
    </div>
  );
}

function InsightList({
  items,
  nameOf,
  slugOf,
  cta,
}: {
  items: InsightRow[];
  nameOf: (id: string | null) => string | null;
  slugOf: (id: string | null) => string | null;
  cta: string;
}) {
  return (
    <ul className="space-y-2.5">
      {items.map((i) => {
        const slug = slugOf(i.subjectId);
        return (
          <li key={i.id} className="rounded-panel border border-line bg-ink-900/35 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {i.topic}
                  {i.kind === "misconception" && (
                    <span className="ml-2 text-xs font-normal text-danger">misconception</span>
                  )}
                </p>
                <p className="text-[0.8125rem] text-fg-subtle">{nameOf(i.subjectId)}</p>
              </div>
              {slug && (
                <Link
                  href={tutorHref(slug, i.topic)}
                  className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-300"
                >
                  {cta}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </div>
            {i.detail && <p className="mt-1.5 text-sm text-fg-muted">{i.detail}</p>}
            {i.evidenceSummary && <p className="mt-1.5 text-[0.8125rem] text-fg-subtle">Why: {i.evidenceSummary}</p>}
          </li>
        );
      })}
    </ul>
  );
}
