import { ArrowRight, Clock3, Compass } from "lucide-react";
import Link from "next/link";
import type { Recommendation } from "@/lib/recommendations/engine";
import { Panel } from "./panel";

export function Recommendations({
  items,
  id = "next-up",
  title = "What to do next",
  emptyText = "You’re all caught up. Suggestions appear here from your exam dates, goals and results.",
}: {
  items: Recommendation[];
  id?: string;
  title?: string;
  emptyText?: string;
}) {
  return (
    <Panel id={id} title={title} icon={Compass}>
      {items.length === 0 ? (
        <p className="text-sm leading-relaxed text-fg-muted">{emptyText}</p>
      ) : (
        <ol className="space-y-2.5">
          {items.map((r, i) => (
            <li key={r.key}>
              <Link
                href={r.action.href}
                className="group relative flex gap-4 rounded-panel border border-line bg-ink-900/35 p-4 transition-[border-color,background-color] duration-200 hover:border-line-strong hover:bg-ink-850/60"
              >
                <span
                  aria-hidden
                  className="mt-1 h-auto w-1 shrink-0 self-stretch rounded-full"
                  style={{
                    background: r.subject
                      ? r.subject.accent
                      : i === 0
                        ? "var(--color-blue-500)"
                        : "var(--color-line-strong)",
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium">{r.title}</span>
                    {r.minutes !== null && (
                      <span className="inline-flex items-center gap-1 text-[0.8125rem] text-fg-subtle">
                        <Clock3 className="size-3.5" aria-hidden />
                        {r.minutes} min
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-fg-muted">{r.reason}</span>
                  <span className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 group-hover:text-blue-300">
                    {r.action.label}
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
