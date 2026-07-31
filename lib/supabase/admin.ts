import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service-role client. BYPASSES RLS.
 *
 * Rules (docs/SECURITY_MODEL.md):
 * - Import only from server code; the "server-only" marker makes any
 *   client-bundle import a build error.
 * - Every use must be preceded by an explicit authorization check via
 *   server/permissions — never call this on unauthenticated paths.
 * - The key must never be logged, returned, or serialized.
 */
export function createAdminSupabase() {
  const pub = publicEnv();
  const srv = serverEnv();
  return createClient<Database>(
    pub.NEXT_PUBLIC_SUPABASE_URL,
    srv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
