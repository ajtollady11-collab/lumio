/**
 * Accept only same-origin relative paths for post-auth redirects.
 * Prevents open-redirect attacks via `?next=https://evil.example`.
 */
export function safeRedirectPath(candidate: string | null | undefined, fallback = "/app"): string {
  if (!candidate) return fallback;
  // Must be a single-slash relative path. Reject protocol-relative (//host),
  // backslash tricks (/\host), and anything with a scheme.
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return fallback;
  }
  if (/[\u0000-\u001f]/.test(candidate)) return fallback;
  try {
    const url = new URL(candidate, "http://lumio.local");
    if (url.origin !== "http://lumio.local") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
