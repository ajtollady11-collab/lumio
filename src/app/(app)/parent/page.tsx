import { Link2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { requireViewer } from "@/lib/auth/session";

/*
 * Phase 1 parent home. Linking to a child (invite + verification) is Phase 2;
 * progress data appears only once a child has linked and chosen what to share.
 */
export default async function ParentHome() {
  const viewer = await requireViewer("/parent");

  return (
    <>
      <PageHeader
        title={`Hello, ${viewer.displayName ?? "there"}`}
        description="This is where you'll follow your children's progress once your accounts are linked."
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="surface rounded-stage p-6 sm:p-8">
          <span className="flex size-11 items-center justify-center rounded-panel bg-blue-500/12 ring-1 ring-blue-400/25">
            <Link2 className="size-5 text-blue-400" aria-hidden />
          </span>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <h2 className="text-display-sm">No children linked yet</h2>
            <Badge tone="violet">Linking opens in the next release</Badge>
          </div>
          <p className="mt-3 max-w-lg leading-relaxed text-fg-muted">
            You&apos;ll invite your child with a one-time code. Their account is only linked once they accept, and
            Family plans will cover up to three children with one combined dashboard.
          </p>
        </section>
        <section className="rounded-stage border border-line bg-ink-900/40 p-6 sm:p-8">
          <ShieldCheck className="size-5 text-cyan-400" aria-hidden />
          <h2 className="mt-4 font-display text-lg font-semibold">What you&apos;ll be able to see</h2>
          <ul className="mt-4 space-y-2.5 text-[0.9375rem] text-fg-muted">
            <li>Study time, lessons and topics covered</li>
            <li>Quiz and exam-practice results</li>
            <li>Upcoming exams and estimated readiness</li>
            <li>A weekly written report</li>
          </ul>
          <p className="mt-5 text-sm leading-relaxed text-fg-subtle">
            Conversations between your child and their tutor stay private unless your child chooses to share them.
          </p>
        </section>
      </div>
    </>
  );
}
