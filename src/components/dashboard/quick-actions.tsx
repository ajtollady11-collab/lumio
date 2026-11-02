import { BarChart3, BookOpenCheck, GraduationCap, Presentation, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { isBuilt } from "@/components/shell/availability";
import { cn } from "@/lib/utils/cn";
import { Reveal } from "./reveal";

type QuickAction = { label: string; detail: string; href: string; icon: LucideIcon };

const ACTIONS: QuickAction[] = [
  { label: "Start learning", detail: "Live lesson", href: "/app/lessons", icon: Presentation },
  { label: "Ask my tutor", detail: "Any subject, any time", href: "/app/tutor", icon: Sparkles },
  { label: "Revise a subject", detail: "Your subjects", href: "/app/subjects", icon: GraduationCap },
  { label: "Take a quiz", detail: "Check understanding", href: "/app/revision", icon: BookOpenCheck },
  { label: "View my progress", detail: "Your learning profile", href: "/app/progress", icon: BarChart3 },
];

/**
 * Every action is a real link. Areas not built yet go to their honest
 * "coming later" page and are labelled "Soon" here so nobody is surprised.
 */
export function QuickActions() {
  return (
    <Reveal aria-labelledby="quick-actions-heading">
      <h2 id="quick-actions-heading" className="sr-only">
        Quick actions
      </h2>
      <ul className="-mx-4 flex snap-x scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
        {ACTIONS.map((a) => {
          const ready = isBuilt(a.href);
          const Icon = a.icon;
          return (
            <li key={a.href} className="w-[42%] shrink-0 snap-start sm:w-auto">
              <Link
                href={a.href}
                className={cn(
                  "group relative flex h-full flex-col gap-3 rounded-panel border p-4 transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5",
                  ready
                    ? "border-blue-400/25 bg-blue-500/[0.07] hover:border-blue-400/50 hover:bg-blue-500/[0.11]"
                    : "border-line bg-ink-900/40 hover:border-line-strong hover:bg-ink-850/70",
                )}
              >
                <span className="flex items-center justify-between">
                  <Icon
                    className={cn(
                      "size-5 transition-colors",
                      ready ? "text-blue-400" : "text-fg-subtle group-hover:text-fg-muted",
                    )}
                    aria-hidden
                  />
                  {!ready && (
                    <span className="rounded-full bg-violet-500/12 px-2 py-0.5 text-[0.6875rem] font-medium text-violet-400 ring-1 ring-violet-400/25 ring-inset">
                      Soon
                    </span>
                  )}
                </span>
                <span>
                  <span className="block text-[0.9375rem] font-medium">{a.label}</span>
                  <span className="mt-0.5 block text-[0.8125rem] text-fg-subtle">
                    {ready ? a.detail : "Coming in a later update"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Reveal>
  );
}
