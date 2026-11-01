import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const tones = {
  neutral: "bg-white/[0.05] text-fg-muted ring-line-strong",
  blue: "bg-blue-500/12 text-blue-400 ring-blue-400/25",
  violet: "bg-violet-500/12 text-violet-400 ring-violet-400/25",
  cyan: "bg-cyan-400/10 text-cyan-400 ring-cyan-400/25",
} as const;

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
