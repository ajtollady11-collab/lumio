/*
 * Subject accents: subtle per-subject colour inside Lumio's blue–violet–cyan
 * family. Used only for thin accent lines, icon tints and soft glows — never
 * for text on its own, and never to carry meaning (the name is always shown).
 * Commonly paired subjects (the sciences, the maths, the Englishes) get
 * clearly different hues.
 */

export type SubjectAccent = { hex: string; soft: string };

const ACCENTS = {
  blue: "#4d86ff",
  violet: "#9a7bff",
  cyan: "#3ed8e8",
  teal: "#34c3a8",
  indigo: "#7279ff",
  sky: "#56b6ff",
  orchid: "#c77dff",
  coral: "#ff8f7d",
  amber: "#f2b45c",
} as const;

const BY_SLUG: Record<string, keyof typeof ACCENTS> = {
  biology: "teal",
  chemistry: "violet",
  physics: "sky",
  mathematics: "blue",
  "further-mathematics": "indigo",
  "english-language": "coral",
  "english-literature": "orchid",
  history: "amber",
  geography: "cyan",
  economics: "blue",
  business: "amber",
  psychology: "orchid",
  "computer-science": "cyan",
};

const ORDER = Object.keys(ACCENTS) as (keyof typeof ACCENTS)[];

function hexToRgb(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function subjectAccent(slug: string): SubjectAccent {
  const key = BY_SLUG[slug] ?? ORDER[[...slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % ORDER.length];
  const hex = ACCENTS[key];
  return { hex, soft: `rgb(${hexToRgb(hex)} / 0.14)` };
}
