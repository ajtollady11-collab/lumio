import type { Metadata } from "next";
import { AccountDetails } from "@/components/account/account-settings";
import { ServiceUnavailable } from "@/components/feedback/service-unavailable";
import { StudentSettings } from "@/components/settings/student-settings";
import { PageHeader } from "@/components/shell/page-header";
import { requireViewer } from "@/lib/auth/session";
import { londonToday } from "@/lib/onboarding/schemas";
import { tryGetReferenceData } from "@/server/curriculum/reference";
import { getStudentFamily } from "@/server/family/data";
import { getStudentSnapshot } from "@/server/onboarding/student-data";

export const metadata: Metadata = { title: "Settings" };

export default async function StudentSettingsPage() {
  const viewer = await requireViewer("/app/settings");
  const [snapshot, reference, parents] = await Promise.all([
    getStudentSnapshot(viewer.id),
    tryGetReferenceData(),
    getStudentFamily(viewer.id),
  ]);
  if (!snapshot || !reference || !parents) return <ServiceUnavailable />;

  return (
    <>
      <PageHeader title="Settings" description="Everything Lumio knows about you, and who you share it with." />
      <StudentSettings
        snapshot={snapshot}
        reference={reference}
        parents={parents}
        today={londonToday()}
        account={<AccountDetails viewer={viewer} />}
      />
    </>
  );
}
