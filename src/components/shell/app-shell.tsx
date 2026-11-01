"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Ellipsis, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { AmbientBackdrop } from "@/components/brand/ambient-backdrop";
import { LumioLogo, LumioMark } from "@/components/brand/logo";
import { springs } from "@/components/motion/presets";
import { cn } from "@/lib/utils/cn";
import { PARENT_NAV, STUDENT_NAV, activeItem, allItems, type NavConfig, type NavItem } from "./navigation";

const CONFIGS = { student: STUDENT_NAV, parent: PARENT_NAV } as const;

/**
 * Application frame for signed-in areas.
 *  - ≥1024px: full sidebar with grouped navigation.
 *  - 768–1023px: compact icon rail, so tablets keep their width for content.
 *  - <768px: top bar plus a thumb-reachable tab bar with a "More" sheet.
 *
 * Navigation config is chosen by key (icons are components, which cannot be
 * passed from Server to Client Components).
 */
export function AppShell({
  variant,
  account,
  children,
}: {
  variant: keyof typeof CONFIGS;
  account: ReactNode;
  children: ReactNode;
}) {
  const config = CONFIGS[variant];

  // The current-page highlight reads the URL. It sits in its own Suspense
  // boundaries so pages with dynamic segments (e.g. /app/subjects/[slug]) can
  // still prerender the shell; the fallback is the same nav, unhighlighted.
  return (
    <div className="relative min-h-dvh md:flex">
      <AmbientBackdrop intensity="low" />
      <Suspense fallback={<Sidebar config={config} account={account} />}>
        <CurrentSidebar config={config} account={account} />
      </Suspense>
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <MobileTopBar home={config.home} account={account} />
        <main id="main" className="flex-1 px-4 pt-6 pb-28 sm:px-6 md:px-8 md:pt-10 md:pb-12 lg:px-12">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
      <Suspense fallback={<MobileTabBar config={config} />}>
        <CurrentMobileTabBar config={config} />
      </Suspense>
    </div>
  );
}

function useCurrentKey(config: NavConfig) {
  return activeItem(config, usePathname())?.key;
}

function CurrentSidebar({ config, account }: { config: NavConfig; account: ReactNode }) {
  return <Sidebar config={config} account={account} currentKey={useCurrentKey(config)} />;
}

function CurrentMobileTabBar({ config }: { config: NavConfig }) {
  return <MobileTabBar config={config} currentKey={useCurrentKey(config)} pathname={usePathname()} />;
}

function Sidebar({ config, currentKey, account }: { config: NavConfig; currentKey?: string; account: ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-ink-900/55 backdrop-blur-xl md:flex md:w-[4.75rem] lg:w-64">
      <div className="flex h-[4.5rem] items-center px-5 lg:px-6">
        <Link href={config.home} aria-label="Lumio home" className="rounded-control">
          <LumioMark className="size-7 lg:hidden" />
          <LumioLogo className="hidden lg:inline-flex" />
        </Link>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
        {config.groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 hidden px-3 text-xs font-medium text-fg-subtle lg:block">{group.label}</p>
            <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-line lg:hidden" />
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.key}>
                  <SidebarLink item={item} active={item.key === currentKey} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-line px-3 py-3">
        {config.footer.map((item) => (
          <SidebarLink key={item.key} item={item} active={item.key === currentKey} />
        ))}
        <div className="mt-1">{account}</div>
      </div>
    </aside>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-control px-3 text-sm transition-colors",
        "justify-center lg:justify-start",
        active ? "text-fg" : "text-fg-muted hover:text-fg",
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          transition={springs.snappy}
          className="absolute inset-0 rounded-control bg-white/[0.06] ring-1 ring-line-strong"
        />
      )}
      {active && (
        <motion.span
          layoutId="sidebar-active-bar"
          transition={springs.snappy}
          className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-full bg-gradient-to-b from-blue-400 to-violet-400"
        />
      )}
      <Icon
        className={cn(
          "relative size-[1.125rem] shrink-0 transition-colors",
          active ? "text-blue-400" : "text-fg-subtle group-hover:text-fg-muted",
        )}
        aria-hidden
      />
      <span className="relative hidden truncate lg:inline">{item.label}</span>
      <span className="sr-only lg:hidden">{item.label}</span>
    </Link>
  );
}

function MobileTopBar({ home, account }: { home: string; account: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-ink-950/70 px-4 backdrop-blur-xl md:hidden">
      <Link href={home} aria-label="Lumio home" className="rounded-control">
        <LumioLogo />
      </Link>
      <div className="flex justify-end">{account}</div>
    </header>
  );
}

function MobileTabBar({ config, currentKey, pathname }: { config: NavConfig; currentKey?: string; pathname?: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = allItems(config).filter((i) => i.primaryOnMobile);
  const secondary = allItems(config).filter((i) => !i.primaryOnMobile);
  const moreActive = secondary.some((i) => i.key === currentKey);

  // Close the sheet whenever navigation happens.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMoreOpen(false);
  }

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink-900/85 px-2 pt-1.5 safe-bottom backdrop-blur-xl md:hidden"
      >
        <ul className="grid grid-cols-5">
          {primary.map((item) => (
            <li key={item.key}>
              <TabLink item={item} active={item.key === currentKey} />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(
                "relative flex h-14 w-full flex-col items-center justify-center gap-1 rounded-control text-[0.6875rem]",
                moreActive ? "text-fg" : "text-fg-subtle",
              )}
            >
              <Ellipsis className={cn("size-5", moreActive && "text-blue-400")} aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} items={secondary} currentKey={currentKey} />
    </>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-14 flex-col items-center justify-center gap-1 rounded-control text-[0.6875rem]",
        active ? "text-fg" : "text-fg-subtle",
      )}
    >
      {active && (
        <motion.span
          layoutId="tab-active"
          transition={springs.snappy}
          className="absolute top-0 h-[3px] w-8 rounded-full bg-gradient-to-r from-blue-400 to-violet-400"
        />
      )}
      <Icon className={cn("size-5", active && "text-blue-400")} aria-hidden />
      <span className="max-w-full truncate px-1">{shortLabel(item.label)}</span>
    </Link>
  );
}

function shortLabel(label: string): string {
  const map: Record<string, string> = {
    "My Tutor": "Tutor",
    "Live Lessons": "Lessons",
    "Revision Centre": "Revise",
    "Weekly reports": "Reports",
  };
  return map[label] ?? label;
}

function MoreSheet({
  open,
  onClose,
  items,
  currentKey,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  currentKey?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <motion.div
            className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="More sections"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={springs.sheet}
            className="absolute inset-x-0 bottom-0 rounded-t-stage border-t border-line-strong bg-ink-850 px-4 pt-3 safe-bottom"
          >
            <div className="mb-2 flex items-center justify-between pl-2">
              <span
                aria-hidden
                className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/15"
              />
              <h2 className="pt-3 text-base font-semibold">More</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="mt-2 flex size-10 items-center justify-center rounded-control text-fg-muted hover:text-fg"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <ul className="pb-3">
              {items.map((item) => {
                const Icon = item.icon;
                const active = item.key === currentKey;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-4 rounded-control px-3 py-3",
                        active ? "bg-white/[0.06]" : "active:bg-white/[0.04]",
                      )}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-white/[0.05]">
                        <Icon className={cn("size-5", active ? "text-blue-400" : "text-fg-muted")} aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[0.9375rem] font-medium">{item.label}</span>
                        <span className="block truncate text-[0.8125rem] text-fg-subtle">{item.description}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
