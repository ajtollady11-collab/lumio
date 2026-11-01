import "server-only";
import { getServerEnv } from "@/lib/config/server-env";

/*
 * Whether the tutor can run. Both are needed:
 *   ANTHROPIC_API_KEY   — generates replies.
 *   SUPABASE_SECRET_KEY — lets the server (not the browser) save tutor
 *                         replies, usage and memory, so none can be forged.
 * Only variable NAMES are ever returned — never values.
 */
export type AiReadiness = { ready: true } | { ready: false; missing: string[] };

export function tutorReadiness(): AiReadiness {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    // A malformed value is reported as missing rather than crashing the page.
    return { ready: false, missing: ["ANTHROPIC_API_KEY", "SUPABASE_SECRET_KEY"] };
  }
  const missing = [
    !env.ANTHROPIC_API_KEY && "ANTHROPIC_API_KEY",
    !env.SUPABASE_SECRET_KEY && "SUPABASE_SECRET_KEY",
  ].filter((x): x is string => Boolean(x));
  return missing.length ? { ready: false, missing } : { ready: true };
}
