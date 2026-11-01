"use client";

import { useState, type FormEvent } from "react";
import { Switch } from "@/components/family/student-family";
import { SettingsSectionHeader, StepFooter } from "@/components/onboarding/step-frame";
import { useSave } from "@/components/onboarding/use-save";
import { TextField } from "@/components/ui/field";
import { saveParentAbout } from "@/server/family/actions";

export function ParentProfileForm({
  firstName,
  weeklyReportOptIn,
}: {
  firstName: string | null;
  weeklyReportOptIn: boolean;
}) {
  const [name, setName] = useState(firstName ?? "");
  const [reports, setReports] = useState(weeklyReportOptIn);
  const [savedAt, setSavedAt] = useState<number>();
  const save = useSave();

  function submit(e: FormEvent) {
    e.preventDefault();
    save.run(
      () => saveParentAbout({ firstName: name, weeklyReportOptIn: reports }),
      () => setSavedAt(Date.now()),
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <SettingsSectionHeader title="Profile">
        Your name is shown to your children when they approve a link.
      </SettingsSectionHeader>
      <div className="space-y-5">
        <TextField
          label="First name"
          name="firstName"
          autoComplete="given-name"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={save.error?.fieldErrors?.firstName}
          className="max-w-sm"
        />
        <div className="flex max-w-lg items-center justify-between gap-4 rounded-panel border border-line bg-ink-900/40 p-4">
          <div>
            <p className="text-[0.9375rem] font-medium">Weekly progress reports</p>
            <p className="text-[0.8125rem] text-fg-muted">Sent once reports are available and a child is linked.</p>
          </div>
          <Switch checked={reports} onChange={() => setReports((r) => !r)} label="Weekly progress reports" />
        </div>
      </div>
      <StepFooter
        host={{ variant: "settings", returnTo: "/parent/settings" }}
        pending={save.pending}
        error={save.error}
        onRetry={save.retry}
        savedAt={savedAt}
      />
    </form>
  );
}
