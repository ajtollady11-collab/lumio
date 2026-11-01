"use client";

import Link from "next/link";
import { Notice } from "@/components/ui/notice";
import type { Failure } from "@/lib/errors";

/** Inline save error with the right next step: retry, or sign in again. */
export function SaveError({
  error,
  onRetry,
  returnTo,
}: {
  error: Failure | null;
  onRetry?: () => void;
  returnTo: string;
}) {
  if (!error) return null;
  return (
    <Notice tone="error">
      {error.message}{" "}
      {error.error === "session_expired" ? (
        <Link href={`/sign-in?next=${encodeURIComponent(returnTo)}`} className="font-medium text-blue-300 underline">
          Sign in
        </Link>
      ) : error.error === "unavailable" || error.error === "unknown" ? (
        onRetry && (
          <button type="button" onClick={onRetry} className="font-medium text-blue-300 underline">
            Try again
          </button>
        )
      ) : null}
    </Notice>
  );
}
