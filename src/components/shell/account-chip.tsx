import Link from "next/link";
import { getViewer } from "@/lib/auth/session";
import { Skeleton } from "@/components/feedback/skeletons";

/**
 * Signed-in identity in the shell. Reads the session, so it always renders
 * inside a <Suspense> boundary (see the app layouts).
 */
export async function AccountChip() {
  const viewer = await getViewer();
  if (!viewer) return null;

  const name = viewer.displayName ?? viewer.email?.split("@")[0] ?? "Your account";
  const initial = name.trim().charAt(0).toUpperCase() || "L";
  const settingsHref = viewer.role === "parent" ? "/parent/settings" : "/app/settings";

  return (
    <Link
      href={settingsHref}
      className="flex items-center gap-3 rounded-control p-1.5 transition-colors hover:bg-white/[0.05] md:justify-center lg:justify-start"
      aria-label={`Account settings for ${name}`}
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 font-display text-sm font-semibold text-white"
      >
        {initial}
      </span>
      <span className="hidden min-w-0 lg:block">
        <span className="block truncate text-sm font-medium text-fg">{name}</span>
        <span className="block text-xs text-fg-subtle">{viewer.role === "parent" ? "Parent" : "Student"}</span>
      </span>
    </Link>
  );
}

export function AccountChipSkeleton() {
  return (
    <div className="flex items-center gap-3 p-1.5 md:justify-center lg:justify-start">
      <Skeleton className="size-8 rounded-full" />
      <Skeleton className="hidden h-4 w-24 lg:block" />
    </div>
  );
}
