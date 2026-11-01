import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { homeFor, requireViewer, type Viewer } from "@/lib/auth/session";

/**
 * Server-side guard for a role's area. The proxy has already turned away
 * signed-out visitors; this verifies the session again (defence in depth) and
 * sends each role to its own area.
 */
export async function RoleGate({ role, from, children }: { role: Viewer["role"]; from: string; children: ReactNode }) {
  const viewer = await requireViewer(from);
  if (viewer.role !== role) redirect(homeFor(viewer.role));
  return <>{children}</>;
}
