"use client";

import { motion } from "framer-motion";
import { pageEnter } from "@/components/motion/presets";

/** Each page settles in briefly on navigation. Used by the app templates. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial="hidden" animate="visible" variants={pageEnter}>
      {children}
    </motion.div>
  );
}
