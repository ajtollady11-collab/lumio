"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { Failure } from "@/lib/errors";
import { SaveError } from "./save-error";

export type StepVariant = "onboarding" | "settings";

/** How a step is hosted: inside the onboarding flow, or as a Settings section. */
export type StepHost = {
  variant: StepVariant;
  /** Onboarding only: the step to record as reached once this one saves. */
  advanceTo?: number;
  onBack?: () => void;
  /** Called after a successful save. */
  onDone?: () => void;
  returnTo: string;
};

export function StepHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-[1.75rem] leading-tight tracking-[-0.025em] sm:text-display-md">{title}</h2>
      {children && <p className="mt-3 max-w-xl leading-relaxed text-fg-muted">{children}</p>}
    </div>
  );
}

export function SettingsSectionHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {children && <p className="mt-1 text-sm leading-relaxed text-fg-muted">{children}</p>}
    </div>
  );
}

/**
 * Footer for every step. Onboarding: Back / Continue. Settings: Save, with a
 * brief "Saved" confirmation so the student knows the change landed.
 */
export function StepFooter({
  host,
  pending,
  error,
  onRetry,
  submitLabel,
  disabled,
  savedAt,
  secondary,
}: {
  host: StepHost;
  pending: boolean;
  error: Failure | null;
  onRetry?: () => void;
  submitLabel?: string;
  disabled?: boolean;
  savedAt?: number;
  secondary?: ReactNode;
}) {
  // "Saved" shows for each new save, then hides itself.
  const [dismissedAt, setDismissedAt] = useState<number>();
  const showSaved = savedAt !== undefined && savedAt !== dismissedAt;
  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setDismissedAt(savedAt), 2400);
    return () => clearTimeout(t);
  }, [savedAt]);

  return (
    <div className="mt-8 space-y-4">
      <SaveError error={error} onRetry={onRetry} returnTo={host.returnTo} />
      <div className="flex items-center gap-3">
        {host.variant === "onboarding" && host.onBack && (
          <Button
            type="button"
            variant="ghost"
            onClick={host.onBack}
            icon={<ArrowLeft className="size-4" aria-hidden />}
          >
            Back
          </Button>
        )}
        <div className="ml-auto flex items-center gap-3">
          {secondary}
          <AnimatePresence>
            {showSaved && (
              <motion.span
                role="status"
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-1.5 text-sm text-success"
              >
                <Check className="size-4" aria-hidden /> Saved
              </motion.span>
            )}
          </AnimatePresence>
          <Button
            type="submit"
            loading={pending}
            disabled={disabled}
            size={host.variant === "onboarding" ? "lg" : "md"}
          >
            {submitLabel ?? (host.variant === "onboarding" ? "Continue" : "Save changes")}
          </Button>
        </div>
      </div>
    </div>
  );
}
