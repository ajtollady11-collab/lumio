import Link from "next/link";
import { TutorOrb } from "@/components/brand/tutor-orb";
import { STUDENT_NAV } from "@/components/shell/navigation";
import { Badge } from "@/components/ui/badge";
import { requireViewer } from "@/lib/auth/session";

/*
 * Phase 1 home: confirms the account works and shows, honestly, what's coming.
 * The full dashboard (recommendations, exams, mastery, streaks) is Phase 2 and
 * is built from real activity only — no sample numbers are shown here.
 */
export default async function StudentHome() {
  const viewer = await requireViewer("/app");
  const name = viewer.displayName ?? "there";
  const areas = STUDENT_NAV.groups.flatMap((g) => g.items).filter((i) => i.href !== STUDENT_NAV.home);

  return (
    <div className="space-y-10">
      <section className="surface relative overflow-hidden rounded-stage p-6 sm:p-10">
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(ellipse_at_80%_50%,rgb(59_123_255/0.16),transparent_65%)]"
        />
        <div className="relative flex flex-col-reverse items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h1 className="text-[2rem] leading-tight tracking-[-0.03em] sm:text-display-md">Hello, {name}</h1>
            <p className="mt-3 text-lg leading-relaxed text-fg-muted">
              Your account is ready. Next you&apos;ll choose your qualification, exam boards and subjects, then create
              your tutor.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Badge tone="blue">Setup opens in the next release</Badge>
            </div>
          </div>
          <TutorOrb state="idle" size={132} label="Your tutor, not yet set up" />
        </div>
      </section>

      <section aria-labelledby="areas-heading">
        <h2 id="areas-heading" className="font-display text-xl font-semibold tracking-tight">
          What Lumio will do for you
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {areas.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="group flex h-full flex-col rounded-panel border border-line bg-ink-900/40 p-5 transition-colors hover:border-line-strong hover:bg-ink-850/70"
                >
                  <Icon className="size-5 text-fg-subtle transition-colors group-hover:text-blue-400" aria-hidden />
                  <span className="mt-4 font-medium">{item.label}</span>
                  <span className="mt-1.5 text-sm leading-relaxed text-fg-muted">{item.description}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
