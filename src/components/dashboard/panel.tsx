import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Reveal } from "./reveal";

/** A dashboard section: layered surface, consistent heading row. */
export function Panel({
  id,
  title,
  icon: Icon,
  action,
  children,
  className,
  highlight,
}: {
  id: string;
  title: string;
  icon?: LucideIcon;
  action?: { label: string; href: string } | ReactNode;
  children: ReactNode;
  className?: string;
  /** Draws attention (e.g. an exam within two weeks). */
  highlight?: boolean;
}) {
  return (
    <Reveal
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn(
        "surface relative h-full scroll-mt-24 overflow-hidden rounded-stage p-5 sm:p-6",
        highlight && "ring-1 ring-cyan-400/30",
        className,
      )}
    >
      {highlight && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 h-48 w-2/3 bg-[radial-gradient(ellipse_at_center,rgb(62_216_232/0.10),transparent_70%)]"
        />
      )}
      <div className="relative flex items-center justify-between gap-3">
        <h2
          id={`${id}-heading`}
          className="flex items-center gap-2.5 font-display text-[1.0625rem] font-semibold tracking-tight"
        >
          {Icon && <Icon className="size-[1.125rem] text-fg-subtle" aria-hidden />}
          {title}
        </h2>
        {action && isLinkAction(action) ? (
          <Link href={action.href} className="shrink-0 rounded-control text-sm text-blue-400 hover:text-blue-300">
            {action.label}
          </Link>
        ) : (
          action
        )}
      </div>
      <div className="relative mt-4">{children}</div>
    </Reveal>
  );
}

function isLinkAction(a: unknown): a is { label: string; href: string } {
  return typeof a === "object" && a !== null && "href" in a && "label" in a && !("$$typeof" in a);
}

/** Calm empty state inside a panel. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-panel border border-dashed border-line-strong p-5",
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-control bg-blue-500/10 text-blue-400 ring-1 ring-blue-400/20">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="font-medium">{title}</p>
        {children && <p className="mt-1 text-sm leading-relaxed text-fg-muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}
