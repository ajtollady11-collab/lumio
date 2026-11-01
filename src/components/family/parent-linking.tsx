"use client";

import { Check, Copy, KeyRound, Link2Off, UserPlus } from "lucide-react";
import { useState } from "react";
import { SaveError } from "@/components/onboarding/save-error";
import { useSave } from "@/components/onboarding/use-save";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { createInvitation, revokeInvitation, unlink } from "@/server/family/actions";
import type { PendingInvitation } from "@/server/family/data";

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

/**
 * Creates a one-time code and shows it once. The parent gives it to their
 * child, who enters it under Settings → Family and approves the link.
 */
export function InviteChildButton({
  label = "Invite a child",
  variant = "primary",
  returnTo,
  onCreated,
}: {
  label?: string;
  variant?: "primary" | "secondary";
  returnTo: string;
  onCreated?: () => void;
}) {
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const save = useSave();

  function create() {
    save.run(createInvitation, (data) => {
      setInvite(data);
      setCopied(false);
      onCreated?.();
    });
  }

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <div className="space-y-3">
        <Button
          type="button"
          variant={variant}
          onClick={create}
          loading={save.pending}
          icon={<UserPlus className="size-4" aria-hidden />}
        >
          {label}
        </Button>
        <SaveError error={save.error} onRetry={save.retry} returnTo={returnTo} />
      </div>
      <Dialog
        open={Boolean(invite)}
        onClose={() => setInvite(null)}
        title="Share this code with your child"
        description="They enter it in Lumio under Settings, then Family, and approve the link. It works once."
      >
        {invite && (
          <div>
            <div className="flex items-center justify-between gap-3 rounded-panel border border-blue-400/30 bg-blue-500/[0.08] px-5 py-4">
              <span
                className="font-mono text-[1.375rem] font-semibold tracking-[0.12em] text-fg sm:text-2xl"
                aria-label={`Code ${invite.code.split("").join(" ")}`}
              >
                {invite.code}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={copy}
                data-autofocus
                icon={copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-fg-muted">
              <li>Valid until {formatDateTime(invite.expiresAt)}.</li>
              <li>We only show it now — if it&apos;s lost, cancel it and create a new one.</li>
              <li>Your child approves the link before you can see anything.</li>
            </ul>
            <Button type="button" className="mt-6 w-full" onClick={() => setInvite(null)}>
              Done
            </Button>
          </div>
        )}
      </Dialog>
    </>
  );
}

export function PendingInvitations({ invitations, returnTo }: { invitations: PendingInvitation[]; returnTo: string }) {
  const save = useSave();
  const [cancelling, setCancelling] = useState<string | null>(null);
  if (!invitations.length) return null;

  return (
    <section aria-labelledby="pending-heading" className="rounded-panel border border-line bg-ink-900/40 p-5">
      <h3 id="pending-heading" className="flex items-center gap-2 text-sm font-medium">
        <KeyRound className="size-4 text-fg-subtle" aria-hidden />
        Codes waiting to be used
      </h3>
      <ul className="mt-3 divide-y divide-line">
        {invitations.map((inv) => (
          <li key={inv.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <span className="text-fg-muted">
              Created {formatDateTime(inv.createdAt)}, expires {formatDateTime(inv.expiresAt)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={save.pending && cancelling === inv.id}
              onClick={() => {
                setCancelling(inv.id);
                save.run(() => revokeInvitation(inv.id));
              }}
            >
              Cancel code
            </Button>
          </li>
        ))}
      </ul>
      <SaveError error={save.error} onRetry={save.retry} returnTo={returnTo} />
    </section>
  );
}

/** Two-step unlink: the first press asks for confirmation inline (no browser dialog). */
export function UnlinkButton({ linkId, name, returnTo }: { linkId: string; name: string; returnTo: string }) {
  const [confirming, setConfirming] = useState(false);
  const save = useSave();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
        icon={<Link2Off className="size-4" aria-hidden />}
      >
        Unlink
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-sm text-fg-muted">Unlink {name}?</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Keep
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          loading={save.pending}
          onClick={() => save.run(() => unlink(linkId))}
        >
          Unlink
        </Button>
      </div>
      <SaveError error={save.error} onRetry={save.retry} returnTo={returnTo} />
    </div>
  );
}
