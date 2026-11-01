import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/skeletons";
import { ServiceUnavailable } from "@/components/feedback/service-unavailable";
import { ParentOnboarding } from "@/components/onboarding/parent-onboarding";
import { StudentOnboarding } from "@/components/onboarding/student-onboarding";
import { getViewerState, homeFor } from "@/lib/auth/session";
import { londonToday } from "@/lib/onboarding/schemas";
import { resumeStep } from "@/lib/onboarding/steps";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tryGetReferenceData } from "@/server/curriculum/reference";
import { factsFrom, getStudentSnapshot } from "@/server/onboarding/student-data";

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Onboarding searchParams={searchParams} />
    </Suspense>
  );
}

async function Onboarding({ searchParams }: { searchParams: PageProps<"/onboarding">["searchParams"] }) {
  const state = await getViewerState();
  if (state.status === "unavailable") return <ServiceUnavailable />;
  if (state.status === "signed_out") redirect("/sign-in?next=/onboarding");
  const { viewer } = state;

  // Finished accounts go straight to their dashboard; edits happen in Settings.
  if (viewer.onboarded) redirect(homeFor(viewer.role));

  if (viewer.role === "parent") {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("parent_profiles")
      .select("first_name, weekly_report_opt_in")
      .eq("profile_id", viewer.id)
      .maybeSingle();
    if (error || !data) return <ServiceUnavailable />;
    return (
      <ParentOnboarding
        email={viewer.email}
        firstName={data.first_name}
        weeklyReportOptIn={data.weekly_report_opt_in}
      />
    );
  }

  const [snapshot, reference] = await Promise.all([getStudentSnapshot(viewer.id), tryGetReferenceData()]);
  if (!snapshot || !reference) return <ServiceUnavailable />;

  // The server decides where a student may resume; ?step= can't skip required steps.
  const params = await searchParams;
  const requested = typeof params.step === "string" ? Number.parseInt(params.step, 10) : null;
  const initialStep = resumeStep(factsFrom(snapshot), requested);

  return (
    <StudentOnboarding initialStep={initialStep} snapshot={snapshot} reference={reference} today={londonToday()} />
  );
}
