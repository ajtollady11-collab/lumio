"use client";

import { motion, useReducedMotion } from "framer-motion";
import { TutorOrb } from "@/components/brand/tutor-orb";
import { easings } from "@/components/motion/presets";

/**
 * Hero illustration: the shape of a real Lumio lesson — the 30-minute plan
 * from the product specification — with the tutor mid-explanation.
 * Clearly labelled as an example; it contains no student data.
 */
const PLAN = [
  { start: 0, end: 5, title: "Introduction and objectives" },
  { start: 5, end: 12, title: "Core concept explanation" },
  { start: 12, end: 18, title: "Visual teaching and diagrams" },
  { start: 18, end: 23, title: "Understanding checks" },
  { start: 23, end: 27, title: "Exam-style questions" },
  { start: 27, end: 30, title: "Summary and assessment" },
] as const;

const CURRENT = 2;
const TOTAL = 30;

export function LessonStage() {
  const reduce = useReducedMotion();

  return (
    <div className="relative">
      <div className="surface relative overflow-hidden rounded-stage p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-fg-subtle">Example lesson plan</p>
            <p className="mt-1 font-display text-lg font-semibold tracking-tight">
              Photosynthesis: the light-dependent reaction
            </p>
            <p className="mt-0.5 text-sm text-fg-muted">A-level Biology, 30 minutes</p>
          </div>
          <TutorOrb state="speaking" size={64} label="Example tutor, speaking" className="-mt-1 -mr-1" />
        </div>

        {/* Timeline bar */}
        <div className="mt-6 flex h-1.5 gap-1" aria-hidden>
          {PLAN.map((step, i) => (
            <div
              key={step.title}
              className="relative overflow-hidden rounded-full bg-white/[0.07]"
              style={{ flexGrow: step.end - step.start }}
            >
              {i <= CURRENT && (
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                  initial={reduce ? false : { width: "0%" }}
                  animate={{ width: i < CURRENT ? "100%" : "55%" }}
                  transition={{ delay: 0.35 + i * 0.28, duration: 0.6, ease: easings.outExpo }}
                />
              )}
            </div>
          ))}
        </div>

        <ol className="mt-5 space-y-1">
          {PLAN.map((step, i) => {
            const state = i < CURRENT ? "done" : i === CURRENT ? "current" : "upcoming";
            return (
              <motion.li
                key={step.title}
                initial={reduce ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.07, duration: 0.5, ease: easings.outExpo }}
                className={
                  "flex items-center gap-3 rounded-control px-3 py-2.5 text-sm " +
                  (state === "current" ? "bg-blue-500/10 ring-1 ring-blue-400/25" : "")
                }
              >
                <span
                  className={
                    "w-14 shrink-0 font-mono text-xs tabular-nums " +
                    (state === "upcoming" ? "text-fg-subtle" : "text-fg-muted")
                  }
                >
                  {step.start}–{step.end}m
                </span>
                <span
                  aria-hidden
                  className={
                    "size-2 shrink-0 rounded-full " +
                    (state === "done"
                      ? "bg-blue-400"
                      : state === "current"
                        ? "bg-cyan-400 shadow-[0_0_0_4px_rgb(62_216_232/0.18)]"
                        : "bg-white/15")
                  }
                />
                <span className={state === "upcoming" ? "text-fg-subtle" : "text-fg"}>{step.title}</span>
                {state === "current" && <span className="sr-only">(in progress)</span>}
              </motion.li>
            );
          })}
        </ol>

        <p className="mt-4 text-right font-mono text-xs text-fg-subtle tabular-nums" aria-hidden>
          14:20 / {TOTAL}:00
        </p>
      </div>

      {/* The tutor's live caption — what "teaching" looks like, not a chat log. */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3, duration: 0.6, ease: easings.outExpo }}
        className="surface-raised relative z-10 mx-4 -mt-6 rounded-panel p-4 text-sm leading-relaxed text-fg-muted sm:mx-10"
      >
        <span className="text-fg">“</span>Light excites electrons in chlorophyll. Watch where they go next on the
        diagram — that flow is what builds the proton gradient.<span className="text-fg">”</span>
      </motion.div>
    </div>
  );
}
