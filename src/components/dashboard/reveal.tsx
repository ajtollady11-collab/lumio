"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { riseIn, sequence } from "@/components/motion/presets";
import { cn } from "@/lib/utils/cn";

/**
 * The dashboard's one orchestrated moment: sections settle in, in reading
 * order. Reduced-motion users get no movement (MotionConfig reducedMotion="user").
 */
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={sequence(0.05)} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );
}

export function Reveal({
  children,
  className,
  as = "section",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
  "aria-labelledby"?: string;
  id?: string;
}) {
  const Tag = as === "section" ? motion.section : motion.div;
  return (
    <Tag variants={riseIn} className={cn(className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Progress bar that fills on mount. */
export function ProgressBar({
  value,
  max,
  label,
  className,
  color,
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
  color?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={cn("h-1.5 overflow-hidden rounded-full bg-white/[0.06]", className)}
    >
      <motion.div
        className="h-full rounded-full"
        style={{
          background: color ?? "linear-gradient(90deg, var(--color-blue-500), var(--color-violet-500))",
        }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      />
    </div>
  );
}
