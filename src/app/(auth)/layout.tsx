import Link from "next/link";
import { AmbientBackdrop } from "@/components/brand/ambient-backdrop";
import { LumioLogo } from "@/components/brand/logo";
import { TutorOrb } from "@/components/brand/tutor-orb";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <AmbientBackdrop intensity="low" />

      <div className="flex flex-col px-5 pt-6 pb-10 sm:px-10">
        <Link href="/" aria-label="Lumio home" className="self-start rounded-control">
          <LumioLogo />
        </Link>
        <main id="main" className="mx-auto flex w-full max-w-[25rem] flex-1 flex-col justify-center py-10">
          {children}
        </main>
      </div>

      {/* Desktop companion panel: the tutor, waiting. */}
      <aside
        aria-hidden
        className="relative m-3 hidden overflow-hidden rounded-stage border border-line bg-ink-900/60 lg:flex lg:flex-col lg:items-center lg:justify-center"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgb(59_123_255/0.16),transparent_60%)]" />
        <TutorOrb state="listening" size={220} />
        <p className="relative mt-14 max-w-sm text-center font-display text-2xl leading-snug font-medium tracking-tight text-fg/90">
          Your tutor learns how you learn — and starts every lesson from there.
        </p>
      </aside>
    </div>
  );
}
