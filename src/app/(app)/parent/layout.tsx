import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/skeletons";
import { AccountChip, AccountChipSkeleton } from "@/components/shell/account-chip";
import { AppShell } from "@/components/shell/app-shell";
import { RoleGate } from "@/components/shell/role-gate";

export const metadata: Metadata = {
  title: { default: "Family overview", template: "%s · Lumio" },
  robots: { index: false, follow: false },
};

export default function ParentLayout({ children }: LayoutProps<"/parent">) {
  return (
    <AppShell
      variant="parent"
      account={
        <Suspense fallback={<AccountChipSkeleton />}>
          <AccountChip />
        </Suspense>
      }
    >
      <Suspense fallback={<PageSkeleton />}>
        <RoleGate role="parent" from="/parent">
          {children}
        </RoleGate>
      </Suspense>
    </AppShell>
  );
}
