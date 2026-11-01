"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import { springs } from "./presets";

/**
 * App-wide motion defaults. `reducedMotion="user"` makes every Framer Motion
 * animation honour the OS "reduce motion" setting: transforms are skipped,
 * opacity changes remain.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={springs.gentle}>
      {children}
    </MotionConfig>
  );
}
