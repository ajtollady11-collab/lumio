import type { Metadata } from "next";
import { Suspense } from "react";
import { RevealGroup } from "@/components/dashboard/reveal";
import { SubjectsOverview } from "@/components/dashboard/subjects-overview";
import { PageSkeleton } from "@/components/feedback/skeletons";
import { ServiceUnavailable } from "@/components/feedback/service-unavailable";
import { PageHeader } from "@/components/shell/page-header";
import { requireViewer } from "@/lib/auth/session";
import { buildSubjects } from "@/lib/dashboard/model";
import { tryGetReferenceData } from "@/server/curriculum/reference";
import { getDashboardActivity } from "@/server/dashboard/activity";
import { getStudentSnapshot } from "@/server/onboarding/student-data";

export const metadata: Metadata = { title: "Subjects" };

export default function SubjectsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Subjects />
    </Suspense>
  );
}

async function Subjects() {
  const viewer = await requireViewer("/app/subjects");
  const [snapshot, activity, reference] = await Promise.all([
    getStudentSnapshot(viewer.id),
    getDashboardActivity(),
    tryGetReferenceData(),
  ]);
  if (!snapshot || !activity || !reference) return <ServiceUnavailable />;
  const subjects = buildSubjects(
    { firstName: null, parentalConsent: "", subjects: snapshot.subjects, exams: snapshot.exams },
    reference,
    activity,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subjects"
        description="Everything Lumio knows about each subject you study. Open one for exams, results and what’s coming."
      />
      <RevealGroup>
        <SubjectsOverview subjects={subjects} today={activity.today} />
      </RevealGroup>
    </div>
  );
}
