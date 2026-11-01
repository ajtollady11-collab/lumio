"use client";

import { useCallback, useState, useTransition } from "react";
import { failure, type ActionResult, type Failure } from "@/lib/errors";

/**
 * Runs a server action with pending state and friendly errors. The caller's
 * form state is never cleared on failure, so a dropped connection loses
 * nothing — the student just presses the button again.
 */
export function useSave() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<Failure | null>(null);
  const [lastAttempt, setLastAttempt] = useState<(() => void) | null>(null);

  const run = useCallback(<T>(action: () => Promise<ActionResult<T>>, onSuccess?: (data: T) => void) => {
    const attempt = () =>
      startTransition(async () => {
        setError(null);
        try {
          const result = await action();
          if (result.ok) onSuccess?.(result.data);
          else setError(result);
        } catch {
          // The request never completed (offline, timeout, server unreachable).
          setError(failure("unavailable"));
        }
      });
    setLastAttempt(() => attempt);
    attempt();
  }, []);

  const retry = useCallback(() => lastAttempt?.(), [lastAttempt]);
  const clear = useCallback(() => setError(null), []);

  return { pending, error, run, retry, clear };
}
