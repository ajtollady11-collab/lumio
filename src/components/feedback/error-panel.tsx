"use client";

import { RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Shared body for route error boundaries. Shows the digest (a server-side
 * reference) but never the raw error message, which may contain internals.
 */
export function ErrorPanel({
  digest,
  onRetry,
  homeHref = "/",
  homeLabel = "Go to the home page",
}: {
  digest?: string;
  onRetry: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
      <div
        aria-hidden
        className="mb-8 size-14 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffb3c0,#ff6f86_45%,#7a2440)] opacity-90 shadow-[0_0_60px_-10px_rgb(255_111_134/0.6)]"
      />
      <h1 className="text-display-sm">Something went wrong on our side</h1>
      <p className="mt-3 text-fg-muted">
        Your work hasn&apos;t been lost. Try again — if it keeps happening, let us know the reference below.
      </p>
      {digest && (
        <p className="mt-4 rounded-control bg-white/[0.04] px-3 py-1.5 font-mono text-xs text-fg-subtle">
          Reference {digest}
        </p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={onRetry} icon={<RotateCcw className="size-4" aria-hidden />}>
          Try again
        </Button>
        <ButtonLink href={homeHref} variant="secondary">
          {homeLabel}
        </ButtonLink>
      </div>
    </div>
  );
}
