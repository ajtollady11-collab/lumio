/**
 * Turns database and network failures into messages a student or parent can
 * act on. Raw error text never reaches the browser.
 */

export type ActionError =
  "unavailable" | "session_expired" | "forbidden" | "duplicate" | "invalid" | "not_found" | "rate_limited" | "unknown";

export type Failure = { ok: false; error: ActionError; message: string; fieldErrors?: Record<string, string> };
export type ActionResult<T = null> = { ok: true; data: T } | Failure;

export function success<T = null>(data: T = null as T): { ok: true; data: T } {
  return { ok: true, data };
}

export const MESSAGES: Record<ActionError, string> = {
  unavailable: "We couldn't reach Lumio's servers just now. Your answers are still here — try again in a moment.",
  session_expired: "You've been signed out. Sign in again to carry on — your saved progress is safe.",
  forbidden: "You don't have permission to do that.",
  duplicate: "That's already been added.",
  invalid: "Some details need checking. Fix the highlighted fields and try again.",
  not_found: "We couldn't find that. It may already have been removed.",
  rate_limited: "Too many attempts. Wait a little while, then try again.",
  unknown: "Something went wrong saving that. Try again.",
};

/** Database-defined error keys raised as 'LUMIO:<key>' by functions and triggers. */
const LUMIO_MESSAGES: Record<string, { error: ActionError; message: string }> = {
  invalid_grade: { error: "invalid", message: "One of the grades isn't on that qualification's scale." },
  too_many_subjects: { error: "invalid", message: "You can choose up to 15 subjects." },
  too_many_exams: { error: "invalid", message: "You've reached the limit for saved exams. Remove an old one first." },
  too_many_invitations: {
    error: "rate_limited",
    message: "You have 5 unused codes. Cancel one or wait for it to expire before creating another.",
  },
  not_signed_in: { error: "session_expired", message: MESSAGES.session_expired },
  wrong_role: { error: "forbidden", message: MESSAGES.forbidden },
  not_found: { error: "not_found", message: MESSAGES.not_found },
  "incomplete:about": { error: "invalid", message: "Your details in “About you” aren't finished yet." },
  "incomplete:qualification": { error: "invalid", message: "Choose your qualification first." },
  "incomplete:subjects": { error: "invalid", message: "Choose at least one subject first." },
  "incomplete:preferences": { error: "invalid", message: "Choose at least one way you like to learn first." },
};

type PostgrestLikeError = { code?: string | null; message?: string | null; status?: number } | null | undefined;

export function failure(error: ActionError, message = MESSAGES[error], fieldErrors?: Record<string, string>): Failure {
  return { ok: false, error, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

/** Maps a Supabase/PostgREST error to a user-facing failure. */
export function fromDatabaseError(err: PostgrestLikeError): Failure {
  if (!err) return failure("unknown");
  const message = err.message ?? "";

  const lumio = /LUMIO:([a-z_:]+)/.exec(message)?.[1];
  if (lumio && LUMIO_MESSAGES[lumio]) return failure(LUMIO_MESSAGES[lumio].error, LUMIO_MESSAGES[lumio].message);

  switch (err.code) {
    case "23505":
      return failure("duplicate");
    case "23503":
    case "23514":
    case "22P02":
    case "22007":
      return failure("invalid");
    case "42501":
      return failure("forbidden");
    case "PGRST301":
    case "PGRST302":
      return failure("session_expired");
  }

  // fetch failures, 5xx, paused project, timeouts
  if (
    (typeof err.status === "number" && err.status >= 500) ||
    /fetch failed|network|timeout|ECONN|ENOTFOUND|503|502|504/i.test(message)
  ) {
    return failure("unavailable");
  }
  return failure("unknown");
}

/** True when an error indicates the database could not be reached at all. */
export function isUnavailable(err: PostgrestLikeError): boolean {
  return fromDatabaseError(err).error === "unavailable";
}
