import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";
import type { Viewer } from "@/lib/auth/session";

/** Account details and sign-out, shared by student and parent Settings. */
export function AccountDetails({ viewer }: { viewer: Viewer }) {
  const rows = [
    { label: "Email", value: viewer.email ?? "Not available" },
    { label: "Account type", value: viewer.role === "parent" ? "Parent" : "Student" },
  ];

  return (
    <div className="space-y-4">
      <div className="mb-5">
        <h2 className="font-display text-lg font-semibold">Account</h2>
        <p className="mt-1 text-sm text-fg-muted">Your sign-in details.</p>
      </div>
      <dl className="surface divide-y divide-line rounded-panel">
        {rows.map((r) => (
          <div key={r.label} className="grid gap-1 px-5 py-4 sm:grid-cols-[10rem_1fr]">
            <dt className="text-sm text-fg-subtle">{r.label}</dt>
            <dd className="text-[0.9375rem] break-words">{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-4 rounded-panel border border-line p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Sign out</p>
          <p className="mt-1 text-sm text-fg-muted">Sign out of Lumio on this device.</p>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary" icon={<LogOut className="size-4" aria-hidden />}>
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
