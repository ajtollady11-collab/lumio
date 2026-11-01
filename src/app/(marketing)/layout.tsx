import Link from "next/link";
import { AmbientBackdrop } from "@/components/brand/ambient-backdrop";
import { LumioLogo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

const SECTIONS = [
  { href: "/#lessons", label: "Lessons" },
  { href: "/#parents", label: "For parents" },
  { href: "/#pricing", label: "Pricing" },
];

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <AmbientBackdrop />
      <header className="sticky top-0 z-40 border-b border-transparent backdrop-blur-xl supports-[backdrop-filter]:bg-ink-950/55">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:h-[4.5rem] sm:px-6">
          <Link href="/" aria-label="Lumio home" className="rounded-control">
            <LumioLogo />
          </Link>
          <nav aria-label="Sections" className="ml-6 hidden items-center gap-1 md:flex">
            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="rounded-control px-3 py-2 text-sm text-fg-muted transition-colors hover:text-fg"
              >
                {s.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ButtonLink href="/sign-in" variant="ghost" size="sm">
              Sign in
            </ButtonLink>
            <ButtonLink href="/sign-up" size="sm">
              Create account
            </ButtonLink>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <LumioLogo className="opacity-80" />
          <p>Built in the UK for GCSE and A-level students.</p>
          <p>© {2026} Lumio</p>
        </div>
      </footer>
    </div>
  );
}
