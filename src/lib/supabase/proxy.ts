import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/config/env";
import { isAuthPage, isProtectedPath } from "@/lib/auth/routes";
import type { Database } from "@/types/database";

/**
 * Runs in src/proxy.ts on every matched request:
 *  1. Refreshes the Supabase session and writes rotated cookies to the response.
 *  2. Redirects signed-out visitors away from protected areas.
 *
 * This is an optimistic check for fast redirects only. Real authorisation is
 * enforced again in the Data Access Layer (src/lib/auth/session.ts) and by
 * Row Level Security in Postgres.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const config = getSupabasePublicConfig();
  const { pathname, search } = request.nextUrl;

  if (!config) {
    // Without Supabase there is no way to sign in, so protected areas stay closed.
    if (isProtectedPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Do not run code between client creation and getClaims(): it validates the
  // JWT signature and refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
    const redirect = NextResponse.redirect(url);
    // Carry over any cookie changes (e.g. a cleared, expired session).
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  if (signedIn && isAuthPage(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}
