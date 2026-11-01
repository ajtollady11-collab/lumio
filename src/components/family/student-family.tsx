"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SettingsSectionHeader } from "@/components/onboarding/step-frame";
import { SaveError } from "@/components/onboarding/save-error";
import { useSave } from "@/components/onboarding/use-save";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { acceptInvitation, previewInvitation, updateSharing } from "@/server/family/actions";
import type { LinkedParent } from "@/server/family/data";
import { cn } from "@/lib/utils/cn";
import { UnlinkButton } from "./parent-linking";

const RETURN_TO = "/app/settings";

/**
 * The student's side of linking: enter a parent's code, see who it's from,
 * approve — then decide what that parent can see.
 */
export function StudentFamily({ parents }: { parents: LinkedParent[] }) {
  return (
    <div>
      <SettingsSectionHeader title="Family">
        Link a parent or carer so they can follow your progress. You choose what they see, and your conversations with
        your tutor stay private unless you decide otherwise.
      </SettingsSectionHeader>
      <div className="space-y-4">
        {parents.map((p) => (
          <LinkedParentCard key={p.linkId} parent={p} />
        ))}
        <LinkWithCode />
      </div>
    </div>
  );
}

function LinkWithCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<{ parentName: string } | null>(null);
  const [linked, setLinked] = useState<string | null>(null);
  const check = useSave();
  const accept = useSave();

  function onCheck(e: FormEvent) {
    e.preventDefault();
    setLinked(null);
    check.run(
      () => previewInvitation(code),
      (data) => setPreview({ parentName: data.parentName }),
    );
  }

  function onApprove() {
    accept.run(
      () => acceptInvitation(code),
      () => {
        setLinked(preview?.parentName ?? "your parent");
        setPreview(null);
        setCode("");
        router.refresh();
      },
    );
  }

  return (
    <div className="rounded-panel border border-line bg-ink-900/40 p-5">
      <AnimatePresence mode="wait" initial={false}>
        {preview ? (
          <motion.div key="confirm" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <p className="font-medium">Link with {preview.parentName}?</p>
            <p className="mt-2 text-sm text-fg-muted">They&apos;ll be able to see:</p>
            <ul className="mt-2 space-y-1 text-sm text-fg-muted">
              <li>Your study time, lessons, subjects and exam dates</li>
              <li>Your quiz and exam-practice results</li>
            </ul>
            <p className="mt-3 flex items-start gap-2 text-sm text-fg-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-400" aria-hidden />
              Not your conversations with your tutor. You can change any of this, or unlink, at any time.
            </p>
            <SaveError error={accept.error} onRetry={accept.retry} returnTo={RETURN_TO} />
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" onClick={onApprove} loading={accept.pending}>
                Approve and link
              </Button>
              <Button type="button" variant="ghost" onClick={() => setPreview(null)}>
                Cancel
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="enter"
            onSubmit={onCheck}
            noValidate
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {linked && (
              <p role="status" className="mb-4 text-sm text-success">
                You&apos;re now linked with {linked}.
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <TextField
                label="Have a code from a parent?"
                name="code"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="ABCD-EFGH-JKMN"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                error={check.error?.fieldErrors?.code}
                className="flex-1"
              />
              <Button type="submit" variant="secondary" loading={check.pending} disabled={!code.trim()}>
                Check code
              </Button>
            </div>
            {check.error && !check.error.fieldErrors && (
              <div className="mt-3">
                <SaveError error={check.error} onRetry={check.retry} returnTo={RETURN_TO} />
              </div>
            )}
            {check.error?.fieldErrors?.code && check.error.message !== check.error.fieldErrors.code && (
              <p className="mt-2 text-[0.8125rem] text-fg-muted">{check.error.message}</p>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

const SCOPES = [
  { key: "shareActivity", label: "Study activity", description: "Study time, lessons, subjects and exam dates" },
  { key: "shareResults", label: "Results", description: "Quiz and exam-practice scores" },
  { key: "shareConversations", label: "Tutor conversations", description: "What you and your tutor say to each other" },
] as const;

function LinkedParentCard({ parent }: { parent: LinkedParent }) {
  const [scopes, setScopes] = useState({
    shareActivity: parent.shareActivity,
    shareResults: parent.shareResults,
    shareConversations: parent.shareConversations,
  });
  const save = useSave();

  function toggle(key: keyof typeof scopes) {
    const next = { ...scopes, [key]: !scopes[key] };
    const previous = scopes;
    setScopes(next);
    save.run(async () => {
      const r = await updateSharing({ linkId: parent.linkId, ...next });
      if (!r.ok) setScopes(previous);
      return r;
    });
  }

  return (
    <div className="surface rounded-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
            <UserRound className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-medium">{parent.name}</p>
            <p className="text-xs text-fg-subtle">Linked parent</p>
          </div>
        </div>
        <UnlinkButton linkId={parent.linkId} name={parent.name} returnTo={RETURN_TO} />
      </div>
      <ul className="mt-4 divide-y divide-line">
        {SCOPES.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-[0.9375rem]">{s.label}</p>
              <p className="text-[0.8125rem] text-fg-subtle">{s.description}</p>
            </div>
            <Switch
              checked={scopes[s.key]}
              label={`Share ${s.label.toLowerCase()} with ${parent.name}`}
              onChange={() => toggle(s.key)}
              disabled={save.pending}
            />
          </li>
        ))}
      </ul>
      <SaveError error={save.error} onRetry={save.retry} returnTo={RETURN_TO} />
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-60",
        checked ? "bg-blue-600" : "bg-white/10",
      )}
    >
      <span
        className={cn(
          "size-6 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
