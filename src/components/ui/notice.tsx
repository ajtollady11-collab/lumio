import { CircleAlert, Info, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const tones = {
  info: { icon: Info, classes: "border-blue-400/25 bg-blue-500/[0.08] text-fg", iconClass: "text-blue-400" },
  error: { icon: CircleAlert, classes: "border-danger/30 bg-danger/[0.08] text-fg", iconClass: "text-danger" },
  success: { icon: CircleCheck, classes: "border-success/30 bg-success/[0.08] text-fg", iconClass: "text-success" },
} as const;

/** Inline message attached to the content it's about. Errors are announced. */
export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  const { icon: Icon, classes, iconClass } = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-control border px-4 py-3 text-sm leading-relaxed", classes, className)}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconClass)} aria-hidden />
      <div>{children}</div>
    </div>
  );
}
