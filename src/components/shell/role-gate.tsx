import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ServiceUnavailable } from "@/components/feedback/service-unavailable";
import { getViewerState, homeFor, type Viewer } from "@/lib/auth/session";

/**
 * Server-side guard for a role's area. The proxy has already turned away
 * signed-out visitors; this verifies the session again (defence in depth),
 * sends each role to its own area, and sends anyone who hasn't finished
 * onboarding to /onboarding — so typing a URL can't skip it.
 */
export async function RoleGate({ role, from, children }: { role: Viewer["role"]; from: string; children: ReactNode }) {
  const state = await getViewerState();
  if (state.status === "unavailable") return <ServiceUnavailable />;
  if (state.status === "signed_out") redirect(`/sign-in?next=${encodeURIComponent(from)}`);

  const { viewer } = state;
  if (viewer.role !== role) redirect(homeFor(viewer.role));
  if (!viewer.onboarded) redirect("/onboarding");
  return <>{children}</>;
}
