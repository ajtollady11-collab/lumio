"use client";

import { useState, type ReactNode } from "react";
import { StudentFamily } from "@/components/family/student-family";
import { ExamsManager } from "@/components/onboarding/exams-manager";
import type { StepHost } from "@/components/onboarding/step-frame";
import {
  AboutStep,
  BoardsStep,
  GoalsStep,
  NeedsSubjects,
  PreferencesStep,
  QualificationStep,
  SubjectsStep,
} from "@/components/onboarding/steps";
import type { ReferenceData } from "@/server/curriculum/reference";
import type { LinkedParent } from "@/server/family/data";
import type { StudentSnapshot } from "@/server/onboarding/student-data";

const host: StepHost = { variant: "settings", returnTo: "/app/settings" };

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "studies", label: "Studies" },
  { id: "exams", label: "Exams" },
  { id: "learning", label: "Learning" },
  { id: "family", label: "Family" },
  { id: "account", label: "Account" },
];

/**
 * Every onboarding answer, editable. Sections share one copy of the data so a
 * change in one (say, removing a subject) is reflected in the others at once.
 */
export function StudentSettings({
  snapshot,
  reference,
  parents,
  today,
  account,
}: {
  snapshot: StudentSnapshot;
  reference: ReferenceData;
  parents: LinkedParent[];
  today: string;
  account: ReactNode;
}) {
  const [data, setData] = useState(snapshot);
  // Remount dependent forms when the subject list changes so they pick up new rows.
  const [subjectsVersion, setSubjectsVersion] = useState(0);
  const patchProfile = (p: Partial<StudentSnapshot["profile"]>) =>
    setData((d) => ({ ...d, profile: { ...d.profile, ...p } }));

  return (
    <div className="grid gap-10 lg:grid-cols-[11rem_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="lg:sticky lg:top-10 lg:self-start">
        <ul className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block rounded-control px-3 py-2 text-sm whitespace-nowrap text-fg-muted transition-colors hover:bg-white/[0.04] hover:text-fg"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-12">
        <Section id="profile">
          <AboutStep host={host} profile={data.profile} onSaved={patchProfile} />
        </Section>

        <Section id="studies">
          <div className="space-y-12">
            <QualificationStep host={host} profile={data.profile} reference={reference} onSaved={patchProfile} />
            <SubjectsStep
              host={host}
              reference={reference}
              subjects={data.subjects}
              primaryQualificationId={data.profile.primaryQualificationId}
              onSaved={(subjects) => {
                setData((d) => ({
                  ...d,
                  subjects,
                  exams: d.exams.filter((e) => subjects.some((s) => s.subjectId === e.subjectId)),
                }));
                setSubjectsVersion((v) => v + 1);
              }}
            />
            {data.subjects.length ? (
              <>
                <BoardsStep
                  key={`boards-${subjectsVersion}`}
                  host={host}
                  reference={reference}
                  subjects={data.subjects}
                  onSaved={(subjects) => {
                    setData((d) => ({ ...d, subjects }));
                    setSubjectsVersion((v) => v + 1);
                  }}
                />
                <GoalsStep
                  key={`goals-${subjectsVersion}`}
                  host={host}
                  reference={reference}
                  subjects={data.subjects}
                  academicGoals={data.profile.academicGoals}
                  onSaved={(subjects, academicGoals) =>
                    setData((d) => ({ ...d, subjects, profile: { ...d.profile, academicGoals } }))
                  }
                />
              </>
            ) : (
              <NeedsSubjects />
            )}
          </div>
        </Section>

        <Section id="exams">
          {data.subjects.length ? (
            <ExamsManager
              key={`exams-${subjectsVersion}`}
              host={host}
              reference={reference}
              subjects={data.subjects}
              exams={data.exams}
              today={today}
              onChange={(exams) => setData((d) => ({ ...d, exams }))}
            />
          ) : (
            <NeedsSubjects />
          )}
        </Section>

        <Section id="learning">
          <PreferencesStep
            host={host}
            preferences={data.profile.learningPreferences}
            onSaved={(learningPreferences) => patchProfile({ learningPreferences })}
          />
        </Section>

        <Section id="family">
          <StudentFamily parents={parents} />
        </Section>

        <Section id="account">{account}</Section>
      </div>
    </div>
  );
}

function Section({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-line pb-12 last:border-b-0">
      {children}
    </section>
  );
}
