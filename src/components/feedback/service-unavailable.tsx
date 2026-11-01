"use client";

import { CloudOff, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

/**
 * Shown when the database can't be reached (for example while a free-plan
 * project wakes from a pause). Nothing is lost; retrying re-runs the request.
 */
export function ServiceUnavailable() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-panel bg-warning/10 text-warning ring-1 ring-warning/25">
        <CloudOff className="size-6" aria-hidden />
      </span>
      <h1 className="mt-6 text-display-sm">Lumio is waking up</h1>
      <p className="mt-3 leading-relaxed text-fg-muted">
        We couldn&apos;t reach your saved data just now. Nothing has been lost — try again in a few seconds.
      </p>
      <Button
        className="mt-8"
        loading={pending}
        onClick={() => startTransition(() => router.refresh())}
        icon={<RotateCcw className="size-4" aria-hidden />}
      >
        Try again
      </Button>
    </div>
  );
}
