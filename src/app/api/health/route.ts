import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/env";

/**
 * Liveness check for uptime monitoring. Reports which integrations are
 * configured — never credentials or their values.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "lumio-web",
    integrations: { supabase: isSupabaseConfigured },
  });
}
