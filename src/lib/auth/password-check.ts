import "server-only";

/**
 * Free replacement for Supabase's paid leaked-password protection.
 *
 * 1. A small blocklist of the most common passwords and patterns.
 * 2. The Have I Been Pwned "Pwned Passwords" range API (free, no key). Only
 *    the first 5 characters of the password's SHA-1 hash leave the server
 *    (k-anonymity) — never the password or the full hash.
 *
 * If the breach lookup is slow or unreachable we allow the password (fail
 * open) rather than block sign-up; the blocklist and length rule still apply.
 */

const COMMON = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "passw0rd",
  "p@ssw0rd",
  "qwerty",
  "qwertyuiop",
  "qwerty123",
  "1234567890",
  "12345678910",
  "0123456789",
  "123456789",
  "1q2w3e4r5t",
  "iloveyou",
  "letmein",
  "welcome",
  "welcome123",
  "football",
  "football1",
  "liverpool",
  "chelsea",
  "arsenal",
  "manchester",
  "monkey",
  "dragon",
  "sunshine",
  "princess",
  "starwars",
  "superman",
  "batman",
  "trustno1",
  "abcdefghij",
  "abc1234567",
  "aaaaaaaaaa",
  "lumio",
  "lumiolumio",
  "lumio12345",
  "homework",
  "revision",
  "gcse2026",
  "alevels2026",
  "school123",
  "schoolwork",
  "minecraft",
  "fortnite",
  "roblox123",
  "pokemon123",
]);

export type PasswordProblem = "common" | "contains_personal" | "breached";

export const PASSWORD_MESSAGES: Record<PasswordProblem, string> = {
  common: "That password is too common. Try a short phrase only you would think of.",
  contains_personal: "Don't include your name or email in your password.",
  breached: "That password has appeared in a data breach elsewhere, so it isn't safe to use. Choose a different one.",
};

/** Checks that need no network. */
export function localPasswordProblem(password: string, personal: string[] = []): PasswordProblem | null {
  const lower = password.toLowerCase();
  const squashed = lower.replace(/[^a-z0-9]/g, "");
  if (COMMON.has(lower) || COMMON.has(squashed)) return "common";
  if (/^(.)\1+$/.test(password)) return "common";
  if (/^(0123456789|1234567890|abcdefghij)/.test(squashed)) return "common";

  for (const p of personal) {
    const token = p.toLowerCase().trim();
    if (token.length >= 3 && lower.includes(token)) return "contains_personal";
  }
  return null;
}

async function sha1Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** True if the password appears in known breaches; null if the check couldn't run. */
export async function isBreachedPassword(
  password: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 2500,
): Promise<boolean | null> {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const res = await fetcher(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "Lumio-password-check" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [candidate, count] = line.trim().split(":");
      if (candidate === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return null;
  }
}

/** Full check used at sign-up and password change. */
export async function passwordProblem(
  password: string,
  personal: string[] = [],
  fetcher: typeof fetch = fetch,
): Promise<PasswordProblem | null> {
  const local = localPasswordProblem(password, personal);
  if (local) return local;
  return (await isBreachedPassword(password, fetcher)) ? "breached" : null;
}
