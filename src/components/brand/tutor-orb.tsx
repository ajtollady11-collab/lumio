"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/utils/cn";

export type TutorState = "idle" | "listening" | "thinking" | "speaking";

const STATE_LABEL: Record<TutorState, string> = {
  idle: "Tutor is ready",
  listening: "Tutor is listening",
  thinking: "Tutor is thinking",
  speaking: "Tutor is speaking",
};

/**
 * The tutor's visual presence — Lumio's signature element.
 *
 * Each state has one distinct motion so a student can tell at a glance what
 * the tutor is doing, even on a small phone screen:
 *  - idle:      slow breathing
 *  - listening: cyan rings radiating outward (the tutor is taking input)
 *  - thinking:  an orbit arc circling the core
 *  - speaking:  the core pulses in a speech-like rhythm
 *
 * With reduced motion the orb is static and the state is conveyed by colour
 * and the accessible label alone.
 */
export function TutorOrb({
  state = "idle",
  size = 160,
  className,
  label,
}: {
  state?: TutorState;
  size?: number;
  className?: string;
  /** Override the accessible label, e.g. "Nova is listening". */
  label?: string;
}) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const animate = !reduce;

  const coreScale = !animate
    ? 1
    : state === "speaking"
      ? [1, 1.06, 0.98, 1.08, 1]
      : state === "idle"
        ? [1, 1.025, 1]
        : 1;
  const coreDuration = state === "speaking" ? 1.1 : 5.5;

  return (
    <div
      role="img"
      aria-label={label ?? STATE_LABEL[state]}
      className={cn("relative isolate shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {/* Halo */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-[-18%] -z-10 rounded-full blur-2xl transition-opacity duration-700",
          state === "listening" ? "opacity-90" : "opacity-60",
        )}
        style={{
          background:
            state === "listening"
              ? "radial-gradient(circle, rgb(62 216 232 / 0.45), rgb(59 123 255 / 0.2) 45%, transparent 70%)"
              : "radial-gradient(circle, rgb(91 146 255 / 0.5), rgb(138 107 255 / 0.25) 45%, transparent 70%)",
        }}
      />

      <svg viewBox="0 0 200 200" className="size-full overflow-visible" aria-hidden>
        <defs>
          <radialGradient id={`core-${uid}`} cx="36%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#eef3ff" />
            <stop offset="18%" stopColor="#9fbcff" />
            <stop offset="48%" stopColor="#3b7bff" />
            <stop offset="82%" stopColor="#6a4df0" />
            <stop offset="100%" stopColor="#2b1f7a" />
          </radialGradient>
          <radialGradient id={`sheen-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#3ed8e8" stopOpacity="0" />
            <stop offset="96%" stopColor="#3ed8e8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#3ed8e8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`arc-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3ed8e8" stopOpacity="0" />
            <stop offset="100%" stopColor="#3ed8e8" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Listening: radiating rings */}
        {state === "listening" &&
          animate &&
          [0, 1, 2].map((i) => (
            <motion.circle
              key={i}
              cx="100"
              cy="100"
              r="62"
              fill="none"
              stroke="#3ed8e8"
              strokeWidth="1.2"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.55, opacity: 0 }}
              transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
              style={{ transformOrigin: "100px 100px" }}
            />
          ))}

        {/* Resting orbit */}
        <circle cx="100" cy="100" r="84" fill="none" stroke="rgb(148 170 255 / 0.14)" strokeWidth="1" />

        {/* Thinking: travelling arc on the orbit */}
        {state === "thinking" && (
          <motion.g
            style={{ transformOrigin: "100px 100px" }}
            animate={animate ? { rotate: 360 } : undefined}
            transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
          >
            <path
              d="M100 16 A84 84 0 0 1 172.7 58"
              fill="none"
              stroke={`url(#arc-${uid})`}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="172.7" cy="58" r="3.5" fill="#3ed8e8" />
          </motion.g>
        )}

        {/* Core */}
        <motion.g
          style={{ transformOrigin: "100px 100px" }}
          animate={{ scale: coreScale }}
          transition={{ duration: coreDuration, repeat: animate ? Infinity : 0, ease: "easeInOut" }}
        >
          <circle cx="100" cy="100" r="62" fill={`url(#core-${uid})`} />
          <circle cx="100" cy="100" r="62" fill={`url(#sheen-${uid})`} />
          <ellipse cx="80" cy="74" rx="20" ry="12" fill="#ffffff" opacity="0.16" transform="rotate(-28 80 74)" />
        </motion.g>
      </svg>
    </div>
  );
}
