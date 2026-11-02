import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/skeletons";
import { ServiceUnavailable } from "@/components/feedback/service-unavailable";
import { LearningProfile } from "@/components/learning/learning-profile";
import { PageHeader } from "@/components/shell/page-header";
import { requireViewer } from "@/lib/auth/session";
import { buildExams, buildSubjects } from "@/lib/dashboard/model";
import { tryGetReferenceData } from "@/server/curriculum/reference";
import { getDashboardActivity } from "@/server/dashboard/activity";
import { getLearningProfile, getTutorBrief } from "@/server/learning/data";
import { getStudentSnapshot } from "@/server/onboarding/student-data";

export const metadata: Metadata = { title: "My Learning Profile" };

export default function ProgressPage() {
  return (
    <div>
      <PageHeader
        title="My Learning Profile"
        description="What Lumio has learned about how you’re doing — built only from your answers. Only you can see it."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Profile />
      </Suspense>
    </div>
  );
}

/*
 * Four parallel reads, all as the signed-in student (RLS): profile snapshot,
 * activity (one RPC), learning profile (one RPC) and cached curriculum names.
 * The tutor brief is one more small read.
 */
async function Profile() {
  const viewer = await requireViewer("/app/progress");
  const [snapshot, activity, reference, learning] = await Promise.all([
    getStudentSnapshot(viewer.id),
    getDashboardActivity(),
    tryGetReferenceData(),
    getLearningProfile(),
  ]);
  if (!snapshot || !activity || !reference || !learning) return <ServiceUnavailable />;
  const tutor = await getTutorBrief(snapshot.profile.learningPreferences);
  if (!tutor) return <ServiceUnavailable />;

  const profileLite = {
    firstName: snapshot.profile.firstName,
    parentalConsent: snapshot.profile.parentalConsent,
    subjects: snapshot.subjects,
    exams: snapshot.exams,
  };
  return (
    <LearningProfile
      profile={learning}
      subjects={buildSubjects(profileLite, reference, activity)}
      exams={buildExams(profileLite, reference, activity.today)}
      activity={activity}
      tutor={tutor}
      learningPreferences={snapshot.profile.learningPreferences}
    />
  );
}
