import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/skeletons";
import { AccountChip, AccountChipSkeleton } from "@/components/shell/account-chip";
import { AppShell } from "@/components/shell/app-shell";
import { RoleGate } from "@/components/shell/role-gate";

export const metadata: Metadata = {
  title: { default: "Home", template: "%s · Lumio" },
  robots: { index: false, follow: false },
};

export default function StudentLayout({ children }: LayoutProps<"/app">) {
  return (
    <AppShell
      variant="student"
      account={
        <Suspense fallback={<AccountChipSkeleton />}>
          <AccountChip />
        </Suspense>
      }
    >
      <Suspense fallback={<PageSkeleton />}>
        <RoleGate role="student" from="/app">
          {children}
        </RoleGate>
      </Suspense>
    </AppShell>
  );
}
