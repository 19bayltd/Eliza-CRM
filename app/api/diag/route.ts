import { NextResponse } from "next/server";

/**
 * TEMPORARY Phase 01 connectivity diagnostic — REMOVE after staging
 * verification completes. Reports NO secrets: hostnames only (both are
 * public — they ship in the client bundle), an outbound reachability
 * check against Supabase auth health, and boolean env presence.
 */
export const dynamic = "force-dynamic";

function hostOf(value: string | undefined): string {
  if (!value) return "unset";
  try {
    return new URL(value).host;
  } catch {
    return "invalid_url";
  }
}

export async function GET() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  let authHealth: string;
  if (!supabaseUrl) {
    authHealth = "skipped_no_url";
  } else {
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      authHealth = `http_${res.status}`;
    } catch (err) {
      authHealth = `fetch_failed_${(err as Error).name ?? "unknown"}`;
    }
  }

  return NextResponse.json({
    diag: "phase01-connectivity",
    supabase_host: hostOf(process.env.NEXT_PUBLIC_SUPABASE_URL),
    app_url_host: hostOf(process.env.NEXT_PUBLIC_APP_URL),
    supabase_auth_health: authHealth,
    publishable_key_present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    service_role_key_present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
