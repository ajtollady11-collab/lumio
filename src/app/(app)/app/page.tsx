import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";
import { ServiceUnavailable } from "@/components/feedback/service-unavailable";
import { requireViewer } from "@/lib/auth/session";
import { tryGetReferenceData } from "@/server/curriculum/reference";
import { getDashboardActivity } from "@/server/dashboard/activity";
import { getLearningProfile } from "@/server/learning/data";
import { getStudentSnapshot } from "@/server/onboarding/student-data";

/*
 * Student home. Four parallel reads, all scoped to the signed-in student by
 * RLS: profile (3 small queries), activity (one RPC), learning profile (one
 * RPC) and curriculum names (shared, cached for hours). Nothing is estimated
 * or invented.
 */
export default function StudentHome() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const viewer = await requireViewer("/app");
  const [snapshot, activity, reference, learning] = await Promise.all([
    getStudentSnapshot(viewer.id),
    getDashboardActivity(),
    tryGetReferenceData(),
    // Optional: if it fails, the page still renders without topic detail.
    getLearningProfile(),
  ]);
  if (!snapshot || !activity || !reference) return <ServiceUnavailable />;

  return (
    <StudentDashboard
      displayName={viewer.displayName ?? "there"}
      profile={{
        firstName: snapshot.profile.firstName,
        parentalConsent: snapshot.profile.parentalConsent,
        subjects: snapshot.subjects,
        exams: snapshot.exams,
      }}
      reference={reference}
      activity={activity}
      learning={learning ?? undefined}
      now={new Date()}
    />
  );
}
