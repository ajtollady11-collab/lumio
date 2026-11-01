import type { Transition, Variants } from "framer-motion";

/**
 * Lumio motion vocabulary. Use these rather than ad-hoc values so the whole
 * product moves with one personality: quick to respond, soft to settle.
 */
export const durations = {
  instant: 0.12,
  quick: 0.2,
  base: 0.32,
  slow: 0.6,
} as const;

export const easings = {
  outExpo: [0.16, 1, 0.3, 1],
  inOutSoft: [0.65, 0, 0.35, 1],
} as const;

export const springs = {
  /** Default for layout and UI responses. */
  gentle: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 },
  /** Active indicators that track the pointer or selection. */
  snappy: { type: "spring", stiffness: 520, damping: 38 },
  /** Large surfaces: sheets, modals. */
  sheet: { type: "spring", stiffness: 340, damping: 36 },
} as const satisfies Record<string, Transition>;

/** Page content entering after navigation. */
export const pageEnter: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: durations.base, ease: easings.outExpo } },
};

/** Parent that reveals its children in sequence — for one orchestrated moment per view. */
export const sequence = (stagger = 0.06, delay = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const riseIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: durations.slow, ease: easings.outExpo } },
};
