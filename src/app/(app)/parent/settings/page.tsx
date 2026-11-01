import type { Metadata } from "next";
import { AccountDetails } from "@/components/account/account-settings";
import { InviteChildButton, PendingInvitations, UnlinkButton } from "@/components/family/parent-linking";
import { ServiceUnavailable } from "@/components/feedback/service-unavailable";
import { ParentProfileForm } from "@/components/settings/parent-profile-form";
import { PageHeader } from "@/components/shell/page-header";
import { requireViewer } from "@/lib/auth/session";
import { londonToday } from "@/lib/onboarding/schemas";
import { getParentHome } from "@/server/family/data";

export const metadata: Metadata = { title: "Settings" };

export default async function ParentSettingsPage() {
  const viewer = await requireViewer("/parent/settings");
  const home = await getParentHome(viewer.id, londonToday());
  if (!home) return <ServiceUnavailable />;

  return (
    <>
      <PageHeader title="Settings" description="Your profile, linked children and account." />
      <div className="max-w-3xl space-y-12">
        <section className="border-b border-line pb-12">
          <ParentProfileForm firstName={home.firstName} weeklyReportOptIn={home.weeklyReportOptIn} />
        </section>

        <section className="space-y-5 border-b border-line pb-12">
          <div>
            <h2 className="font-display text-lg font-semibold">Linked children</h2>
            <p className="mt-1 text-sm text-fg-muted">Unlinking stops you seeing their progress straight away.</p>
          </div>
          {home.children.length ? (
            <ul className="surface divide-y divide-line rounded-panel">
              {home.children.map((c) => (
                <li key={c.linkId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <span className="font-medium">{c.name}</span>
                  <UnlinkButton linkId={c.linkId} name={c.name} returnTo="/parent/settings" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">No children linked yet.</p>
          )}
          <PendingInvitations invitations={home.invitations} returnTo="/parent/settings" />
          <InviteChildButton label="Create a code" variant="secondary" returnTo="/parent/settings" />
        </section>

        <section>
          <AccountDetails viewer={viewer} />
        </section>
      </div>
    </>
  );
}
