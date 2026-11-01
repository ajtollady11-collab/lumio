"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { InviteChildButton } from "@/components/family/parent-linking";
import { Switch } from "@/components/family/student-family";
import { easings } from "@/components/motion/presets";
import { TextField } from "@/components/ui/field";
import { completeParentOnboarding, saveParentAbout } from "@/server/family/actions";
import { StepFooter, StepHeader, type StepHost } from "./step-frame";
import { useSave } from "./use-save";

const STEPS = ["About you", "Link your child", "All set"] as const;

/** Parent onboarding: who you are, link a child (optional), done. */
export function ParentOnboarding({
  email,
  firstName,
  weeklyReportOptIn,
}: {
  email: string | null;
  firstName: string | null;
  weeklyReportOptIn: boolean;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(firstName ? 2 : 1);
  const [name, setName] = useState(firstName ?? "");
  const [reports, setReports] = useState(weeklyReportOptIn);
  const [invited, setInvited] = useState(false);
  const about = useSave();
  const finish = useSave();

  const host = (n: number): StepHost => ({
    variant: "onboarding",
    onBack: n > 1 ? () => setStep(n - 1) : undefined,
    returnTo: "/onboarding",
  });

  function saveAboutStep(e: FormEvent) {
    e.preventDefault();
    about.run(
      () => saveParentAbout({ firstName: name, weeklyReportOptIn: reports }),
      () => setStep(2),
    );
  }

  function complete(e: FormEvent) {
    e.preventDefault();
    finish.run(completeParentOnboarding, () => {
      router.replace("/parent");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-10">
        <div className="mb-2.5 flex items-baseline justify-between text-sm">
          <span className="font-medium">{STEPS[step - 1]}</span>
          <span className="text-fg-subtle tabular-nums">
            Step {step} of {STEPS.length}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
            initial={false}
            animate={{ width: `${(step / STEPS.length) * 100}%` }}
            transition={{ duration: 0.5, ease: easings.outExpo }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0, transition: { duration: 0.36, ease: easings.outExpo } }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          {step === 1 && (
            <form onSubmit={saveAboutStep} noValidate>
              <StepHeader title="Welcome to Lumio">
                Your parent account lets you follow your child&apos;s progress once they&apos;ve linked with you.
              </StepHeader>
              <div className="space-y-6">
                <TextField
                  label="Your first name"
                  name="firstName"
                  autoComplete="given-name"
                  maxLength={40}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={about.error?.fieldErrors?.firstName}
                  hint="Shown to your child when they approve the link."
                  className="max-w-sm"
                />
                <div className="max-w-sm">
                  <p className="text-sm font-medium">Email</p>
                  <p className="mt-1.5 text-[0.9375rem] text-fg-muted">{email ?? "Not available"}</p>
                </div>
                <div className="flex max-w-lg items-center justify-between gap-4 rounded-panel border border-line bg-ink-900/40 p-4">
                  <div>
                    <p className="text-[0.9375rem] font-medium">Weekly progress reports</p>
                    <p className="text-[0.8125rem] text-fg-muted">
                      A summary each week once your child is linked and reports are available.
                    </p>
                  </div>
                  <Switch checked={reports} onChange={() => setReports((r) => !r)} label="Weekly progress reports" />
                </div>
              </div>
              <StepFooter host={host(1)} pending={about.pending} error={about.error} onRetry={about.retry} />
            </form>
          )}

          {step === 2 && (
            <form onSubmit={(e) => (e.preventDefault(), setStep(3))}>
              <StepHeader title="Link your child">
                Create a one-time code and give it to your child. They enter it in their own Lumio account and approve
                the link — nothing is shared until they do.
              </StepHeader>
              <div className="surface rounded-stage p-6">
                <ol className="space-y-3 text-[0.9375rem] text-fg-muted">
                  <li>1. Create a code below.</li>
                  <li>2. Your child signs in and opens Settings, then Family.</li>
                  <li>3. They enter the code and approve.</li>
                </ol>
                <div className="mt-6">
                  <InviteChildButton
                    label={invited ? "Create another code" : "Create a code"}
                    variant={invited ? "secondary" : "primary"}
                    returnTo="/onboarding"
                    onCreated={() => setInvited(true)}
                  />
                </div>
                <p className="mt-5 flex items-start gap-2 text-sm text-fg-subtle">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-400" aria-hidden />
                  Your child&apos;s conversations with their tutor stay private unless they choose to share them.
                </p>
              </div>
              <StepFooter
                host={host(2)}
                pending={false}
                error={null}
                submitLabel={invited ? "Continue" : "Skip for now"}
              />
            </form>
          )}

          {step === 3 && (
            <form onSubmit={complete}>
              <StepHeader title={`You're all set, ${name.trim() || "there"}`}>
                {invited
                  ? "Once your child enters the code and approves, they'll appear on your dashboard."
                  : "You can link a child at any time from your dashboard."}
              </StepHeader>
              <StepFooter
                host={host(3)}
                pending={finish.pending}
                error={finish.error}
                onRetry={finish.retry}
                submitLabel="Go to my dashboard"
              />
            </form>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
