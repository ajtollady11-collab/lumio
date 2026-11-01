import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/config/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Single landing point for every auth link:
 *  - Email links (sign-up confirmation, password recovery, email change) using
 *    the token_hash template — works even when opened on a different device.
 *  - OAuth (Google) and PKCE email links, which arrive with a `code`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"));
  const failure = (reason: string) => NextResponse.redirect(new URL(`/sign-in?error=${reason}`, request.url));

  if (!getSupabasePublicConfig()) return failure("unavailable");

  const supabase = await createSupabaseServerClient();
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return failure("link_expired");
    return NextResponse.redirect(new URL(type === "recovery" ? "/reset-password" : next, request.url));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failure("link_expired");
    return NextResponse.redirect(new URL(next, request.url));
  }

  return failure("invalid_link");
}
