/** Route prefixes that require a signed-in user. */
export const PROTECTED_PREFIXES = ["/app", "/parent", "/admin", "/onboarding"] as const;

/** Auth pages a signed-in user has no reason to see. */
export const AUTH_PAGES = ["/sign-in", "/sign-up", "/forgot-password"] as const;

export function isAuthPage(pathname: string): boolean {
  return (AUTH_PAGES as readonly string[]).includes(pathname);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
