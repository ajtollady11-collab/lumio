"use client";

import { useId } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * The Lumio mark: a lit core with an orbit — the tutor's presence in miniature.
 * It shares its geometry with <TutorOrb /> so the brand and the product's
 * central character read as one idea.
 *
 * Gradient ids are unique per instance: with a shared id, hiding the first
 * instance (display:none) disables its <defs> and every later mark loses its fill.
 */
export function LumioMark({ className, title }: { className?: string; title?: string }) {
  const uid = useId().replace(/:/g, "");
  const core = `lumio-mark-core-${uid}`;
  const orbit = `lumio-mark-orbit-${uid}`;
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <radialGradient id={core} cx="38%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#d9e4ff" />
          <stop offset="35%" stopColor="#5b92ff" />
          <stop offset="100%" stopColor="#7a5cff" />
        </radialGradient>
        <linearGradient id={orbit} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3ed8e8" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#8a6bff" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="7.5" fill={`url(#${core})`} />
      <path
        d="M4.2 19.6c-1.6-4.9 2.6-10.7 9.5-13a12.6 12.6 0 0 1 14.2 3.2"
        fill="none"
        stroke={`url(#${orbit})`}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="27.9" cy="9.8" r="1.7" fill="#3ed8e8" />
    </svg>
  );
}

export function LumioLogo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LumioMark className="size-7" />
      {!compact && (
        <span
          aria-hidden
          className="font-display text-[1.375rem] leading-none font-semibold tracking-[-0.03em] text-fg"
        >
          lumio
        </span>
      )}
      <span className="sr-only">Lumio</span>
    </span>
  );
}
