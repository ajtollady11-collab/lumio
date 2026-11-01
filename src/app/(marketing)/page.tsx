import { Check, Lock } from "lucide-react";
import { LessonStage } from "@/components/marketing/lesson-stage";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PLANS, formatPrice } from "@/lib/config/plans";
import { cn } from "@/lib/utils/cn";

const LESSON_FLOW = [
  {
    title: "Plan",
    body: "Pick a topic and how long you have. Your tutor builds a lesson plan from your exam board's specification before teaching starts.",
  },
  {
    title: "Teach",
    body: "It explains out loud or in text, at your pace, and draws accurate diagrams as it goes. Interrupt whenever something doesn't click.",
  },
  {
    title: "Check",
    body: "Short questions confirm you've understood before moving on. Struggling? It tries a different explanation rather than repeating itself.",
  },
  {
    title: "Practise",
    body: "Exam-style questions with mark allocations, marked against the assessment criteria, with specific ways to improve.",
  },
  {
    title: "Remember",
    body: "What you found hard is saved to your learning profile, so the next lesson, flashcards and revision plan start from there.",
  },
];

const SHARING = [
  { label: "Study time and lessons completed", on: true },
  { label: "Quiz and exam-practice results", on: true },
  { label: "Conversations with the tutor", on: false },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-20 lg:pb-28">
        <div>
          <h1 className="max-w-[13ch] text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.04em] sm:text-display-lg lg:text-display-xl">
            A tutor that teaches you, not just answers you
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-fg-muted">
            Lumio gives you your own AI tutor. It plans each lesson around your exam board, explains it out loud, draws
            the diagrams, checks you&apos;ve understood — and remembers what you found hard next time.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="/sign-up" size="lg">
              Create your tutor
            </ButtonLink>
            <ButtonLink href="/sign-in" variant="secondary" size="lg">
              Sign in
            </ButtonLink>
          </div>
          <p className="mt-7 text-sm text-fg-subtle">
            For GCSE and A-level students in the UK, studying with AQA, Pearson Edexcel, OCR or WJEC.
          </p>
        </div>
        <LessonStage />
      </section>

      {/* How a lesson works — a true sequence, so it's numbered */}
      <section id="lessons" className="scroll-mt-24 border-t border-line/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-2xl">
            <h2 className="text-display-sm sm:text-display-md">A lesson, not a chat window</h2>
            <p className="mt-4 text-fg-muted">
              Every session has a structure, an objective and an end point — the way a good private tutor works.
            </p>
          </div>
          <ol className="mt-14 grid gap-px overflow-hidden rounded-panel bg-line md:grid-cols-5">
            {LESSON_FLOW.map((step, i) => (
              <li key={step.title} className="bg-ink-900/90 p-6 md:min-h-64">
                <span className="font-display text-sm font-semibold text-blue-400 tabular-nums">{i + 1}</span>
                <h3 className="mt-6 font-display text-xl font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-fg-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Parents */}
      <section id="parents" className="scroll-mt-24 border-t border-line/60">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:py-28">
          <div>
            <h2 className="text-display-sm sm:text-display-md">Parents see progress, not private conversations</h2>
            <p className="mt-5 text-fg-muted">
              Link a parent account to see study time, results, upcoming exams and a weekly report written from real
              activity. Students choose what they share, and conversations with the tutor stay private unless they
              decide otherwise.
            </p>
            <p className="mt-4 text-fg-muted">
              Readiness estimates are always labelled as estimates — never presented as official predicted grades.
            </p>
          </div>
          <div className="surface rounded-stage p-6 sm:p-8">
            <p className="text-sm text-fg-muted">Shared with a linked parent</p>
            <ul className="mt-5 divide-y divide-line">
              {SHARING.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-4 py-4">
                  <span className={cn("text-[0.9375rem]", item.on ? "text-fg" : "text-fg-muted")}>{item.label}</span>
                  <span
                    aria-label={item.on ? "Shared" : "Not shared"}
                    className={cn(
                      "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors",
                      item.on ? "bg-blue-500" : "bg-white/10",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full bg-white shadow transition-transform",
                        item.on ? "translate-x-4" : "translate-x-0",
                      )}
                    >
                      {!item.on && <Lock className="size-3 text-ink-700" aria-hidden />}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-fg-subtle">The student controls these settings.</p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-24 border-t border-line/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-2xl">
            <h2 className="text-display-sm sm:text-display-md">Plans</h2>
            <p className="mt-4 text-fg-muted">
              Start free. Paid plans include generous monthly allowances for lessons, voice time and marked practice —
              allowances are published in full before you subscribe.
            </p>
          </div>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {PLANS.map((plan) => {
              const featured = plan.id === "premium";
              return (
                <article
                  key={plan.id}
                  className={cn(
                    "flex flex-col rounded-panel p-7",
                    featured ? "surface-raised ring-1 ring-blue-400/30" : "surface",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
                    {plan.availability === "planned" && <Badge tone="violet">Coming later</Badge>}
                  </div>
                  <p className="mt-5 flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-semibold tracking-tight tabular-nums">
                      {formatPrice(plan.monthlyPricePence)}
                    </span>
                    <span className="text-sm text-fg-subtle">a month</span>
                  </p>
                  <p className="mt-3 text-[0.9375rem] text-fg-muted">{plan.summary}</p>
                  <ul className="mt-6 space-y-3 text-[0.9375rem]">
                    {plan.highlights.map((h) => (
                      <li key={h} className="flex gap-3">
                        <Check className="mt-0.5 size-4 shrink-0 text-blue-400" aria-hidden />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
          <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <ButtonLink href="/sign-up">Create a free account</ButtonLink>
            <p className="text-sm text-fg-subtle">Paid subscriptions open at launch. No card needed to start.</p>
          </div>
        </div>
      </section>
    </>
  );
}
