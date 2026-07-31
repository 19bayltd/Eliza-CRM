import "server-only";

import { headers } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { internal } from "@/server/errors";
import { sanitizeAuditValue } from "@/server/audit/sanitize";

export type AuditEvent = {
  module: string;
  action: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  approvalReference?: string | null;
  result?: "success" | "failure";
  failureReason?: string | null;
};

async function requestMetadata(): Promise<{
  userAgent: string | null;
  requestId: string | null;
}> {
  try {
    const h = await headers();
    return {
      userAgent: h.get("user-agent"),
      requestId: h.get("x-request-id") ?? crypto.randomUUID(),
    };
  } catch {
    // Outside a request context (scripts, tests).
    return { userAgent: null, requestId: crypto.randomUUID() };
  }
}

/**
 * Writes an audit event (append-only table; service-role client).
 * For sensitive mutations call with `critical: true` (default) so a failed
 * audit write fails the operation — no silent audit gaps. Use
 * `critical: false` only for high-volume non-mutating events (e.g. failed
 * sign-in attempts) where availability wins.
 */
export async function writeAudit(
  event: AuditEvent,
  opts: { critical?: boolean } = {},
): Promise<void> {
  const { critical = true } = opts;
  const meta = await requestMetadata();
  const admin = createAdminSupabase();

  const { error } = await admin.from("audit_log").insert({
    module: event.module,
    action: event.action,
    actor_user_id: event.actorUserId ?? null,
    actor_email: event.actorEmail ?? null,
    company_id: event.companyId ?? null,
    branch_id: event.branchId ?? null,
    entity_type: event.entityType ?? null,
    entity_id: event.entityId ?? null,
    previous_value:
      event.previousValue === undefined
        ? null
        : sanitizeAuditValue(event.previousValue),
    new_value:
      event.newValue === undefined ? null : sanitizeAuditValue(event.newValue),
    reason: event.reason ?? null,
    approval_reference: event.approvalReference ?? null,
    request_id: meta.requestId,
    user_agent: meta.userAgent,
    result: event.result ?? "success",
    failure_reason: event.failureReason ?? null,
  });

  if (error) {
    console.error(`audit write failed: ${event.module}.${event.action}`);
    if (critical) {
      throw internal("Operation aborted: audit trail could not be written");
    }
  }
}
