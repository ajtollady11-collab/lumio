import { GraduationCap, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import type { SubjectSummary } from "@/lib/dashboard/model";
import { EmptyState, Panel } from "./panel";
import { SubjectCard, type TopicCounts } from "./subject-card";

export function SubjectsOverview({
  subjects,
  today,
  topicCounts,
}: {
  subjects: SubjectSummary[];
  today: string;
  topicCounts?: Record<string, TopicCounts>;
}) {
  return (
    <Panel
      id="subjects"
      title="Your subjects"
      icon={GraduationCap}
      action={subjects.length ? { label: "Edit subjects", href: "/app/settings#studies" } : undefined}
    >
      {subjects.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No subjects yet"
          action={
            <ButtonLink href="/app/settings#studies" size="sm">
              Choose subjects
            </ButtonLink>
          }
        >
          Pick the subjects you’re studying so your tutor, exam countdowns and suggestions can be built around them.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((s) => (
            <li key={s.subjectId}>
              <SubjectCard subject={s} today={today} topics={topicCounts?.[s.subjectId]} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
