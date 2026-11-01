"use client";

import { useEffect } from "react";
import { AmbientBackdrop } from "@/components/brand/ambient-backdrop";
import { ErrorPanel } from "@/components/feedback/error-panel";

export default function RootSegmentError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  useEffect(() => {
    // Replace with the error-reporting service when observability is wired up (Phase 8).
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="relative flex min-h-dvh items-center justify-center">
      <AmbientBackdrop intensity="low" />
      <ErrorPanel digest={digest} onRetry={retry} />
    </main>
  );
}
