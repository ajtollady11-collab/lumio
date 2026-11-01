import type { ReactNode } from "react";
import { Notice } from "@/components/ui/notice";
import { isSupabaseConfigured } from "@/lib/config/env";

export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-display-sm sm:text-[2rem]">{title}</h1>
      {children && <p className="mt-3 text-fg-muted">{children}</p>}
    </div>
  );
}

/** Shown only when this deployment has no Supabase credentials yet. */
export function AuthUnavailableNotice() {
  if (isSupabaseConfigured) return null;
  return (
    <Notice tone="info" className="mb-6">
      Accounts aren&apos;t open in this environment yet — authentication hasn&apos;t been connected.
    </Notice>
  );
}
