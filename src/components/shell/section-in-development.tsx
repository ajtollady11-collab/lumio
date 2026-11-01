import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "./page-header";
import type { NavItem } from "./navigation";

/**
 * Honest state for an area whose features haven't shipped yet. It says what
 * the area will do and when, and offers a working way back — never a fake
 * screen with buttons that do nothing.
 */
export function SectionInDevelopment({ item, homeHref }: { item: NavItem; homeHref: string }) {
  const Icon = item.icon;
  return (
    <>
      <PageHeader title={item.label} description={item.description} />
      <div className="surface relative overflow-hidden rounded-stage px-6 py-12 sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 size-72 rounded-full bg-[radial-gradient(circle,rgb(59_123_255/0.18),transparent_65%)]"
        />
        <div className="relative max-w-xl">
          <span className="flex size-12 items-center justify-center rounded-panel bg-blue-500/12 ring-1 ring-blue-400/25">
            <Icon className="size-6 text-blue-400" aria-hidden />
          </span>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <h2 className="text-display-sm">Not available yet</h2>
            <Badge tone="violet">Planned for phase {item.phase}</Badge>
          </div>
          <p className="mt-3 leading-relaxed text-fg-muted">
            {item.label} is being built. Nothing here records or uses your data until it&apos;s ready, and it will
            appear in this space when it is.
          </p>
          <ButtonLink href={homeHref} variant="secondary" className="mt-8">
            Back to home
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
