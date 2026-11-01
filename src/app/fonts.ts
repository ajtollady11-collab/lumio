import localFont from "next/font/local";

/*
 * Self-hosted variable fonts (SIL Open Font License). Shipping them from our
 * own origin avoids third-party font requests — no visitor data leaves Lumio
 * just to render text.
 */

/** Display: headings, numerals, the wordmark. Characterful grotesque with optical warmth. */
export const bricolage = localFont({
  src: "./fonts/BricolageGrotesque.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
  adjustFontFallback: "Arial",
});

/** Text: everything people read at length. Open apertures, calm rhythm. */
export const hanken = localFont({
  src: "./fonts/HankenGrotesk.woff2",
  variable: "--font-hanken",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: "Arial",
});

/** Mono: equations, code and working-out in lessons — never decorative labels. */
export const jetbrains = localFont({
  src: "./fonts/JetBrainsMono.woff2",
  variable: "--font-jetbrains",
  weight: "100 800",
  display: "swap",
  preload: false,
});
