import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { MotionGlobalConfig } from "framer-motion";
import { afterEach, vi } from "vitest";

// Animations add nothing to behaviour tests and make timing non-deterministic.
MotionGlobalConfig.skipAnimations = true;
Element.prototype.scrollIntoView ??= () => {};

afterEach(() => cleanup());

// `server-only` throws outside a React Server environment; tests import server modules directly.
vi.mock("server-only", () => ({}));

// jsdom lacks matchMedia, which Framer Motion uses for reduced-motion detection.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
