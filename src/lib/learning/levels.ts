/*
 * Topic mastery levels. The numbers are computed in Postgres
 * (private.recompute_mastery — see LUMIO_AI_ARCHITECTURE.md §0b); this file
 * only names and explains them, for the UI and the tutor prompt.
 */

export type MasteryLevel = 1 | 2 | 3 | 4 | 5 | 6;

export const MASTERY_LEVELS: Record<MasteryLevel, { label: string; short: string; meaning: string }> = {
  1: { label: "Not started", short: "Not started", meaning: "Not studied in Lumio yet." },
  2: {
    label: "Introduced",
    short: "Introduced",
    meaning: "Studied, but not enough answers yet to judge understanding.",
  },
  3: {
    label: "Developing understanding",
    short: "Developing",
    meaning: "Fewer than half of recent answers show understanding.",
  },
  4: {
    label: "Good understanding",
    short: "Good",
    meaning: "Most recent answers are right, or there isn't yet enough evidence to go higher.",
  },
  5: {
    label: "Strong understanding",
    short: "Strong",
    meaning: "At least 4 pieces of evidence, with three quarters or more showing understanding.",
  },
  6: {
    label: "Mastered",
    short: "Mastered",
    meaning:
      "Consistently right over at least two different days, including a harder question or your own explanation, with no recent mistakes.",
  },
};

export const levelLabel = (level: number) => MASTERY_LEVELS[Math.min(6, Math.max(1, level)) as MasteryLevel].label;

/** "Not assessed yet" is shown until there are at least 2 pieces of evidence. */
export const isAssessed = (level: number, evidenceCount: number) => level >= 3 && evidenceCount >= 2;
