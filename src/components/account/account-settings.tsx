import { LogOut } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";
import { requireViewer } from "@/lib/auth/session";

/** Shared account settings for students and parents. Profile editing arrives with onboarding (Phase 2). */
export async function AccountSettings({ from }: { from: string }) {
  const viewer = await requireViewer(from);

  const rows = [
    { label: "Name", value: viewer.displayName ?? "Not set" },
    { label: "Email", value: viewer.email ?? "Not available" },
    { label: "Account type", value: viewer.role === "parent" ? "Parent" : "Student" },
  ];

  return (
    <>
      <PageHeader title="Settings" description="Your account details." />
      <div className="max-w-2xl space-y-4">
        <section className="surface rounded-panel" aria-labelledby="account-heading">
          <h2 id="account-heading" className="px-6 pt-5 font-display text-lg font-semibold">
            Account
          </h2>
          <dl className="mt-2 divide-y divide-line">
            {rows.map((r) => (
              <div key={r.label} className="grid gap-1 px-6 py-4 sm:grid-cols-[10rem_1fr]">
                <dt className="text-sm text-fg-subtle">{r.label}</dt>
                <dd className="text-[0.9375rem] break-words">{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="flex flex-col gap-4 rounded-panel border border-line p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">Sign out</h2>
            <p className="mt-1 text-sm text-fg-muted">Sign out of Lumio on this device.</p>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="secondary" icon={<LogOut className="size-4" aria-hidden />}>
              Sign out
            </Button>
          </form>
        </section>
      </div>
    </>
  );
}
