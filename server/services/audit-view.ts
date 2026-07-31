import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { PERMISSIONS, getAccessContext } from "@/server/permissions";
import { evaluatePermission } from "@/server/permissions/evaluate";
import { forbidden, internal } from "@/server/errors";
import type { Tables } from "@/types/database";

export type AuditQuery = {
  companyId?: string;
  module?: string;
  limit?: number;
};

/**
 * Audit log reads are server-side only (the table has no client RLS
 * policies). Callers see events for companies where they hold
 * audit.log.view, plus — with a global grant — system-wide events that
 * have no company (e.g. invitations before scoping).
 */
export async function listAuditEvents(
  query: AuditQuery = {},
): Promise<Tables<"audit_log">[]> {
  const ctx = await getAccessContext();
  const viewable = ctx.companyIds.filter(
    (companyId) =>
      evaluatePermission(ctx, { permission: PERMISSIONS.auditView, companyId }).allowed,
  );
  const hasGlobal = ctx.roleGrants.some(
    (g) => g.companyId === null && g.permissions.includes(PERMISSIONS.auditView),
  );
  if (viewable.length === 0 && !hasGlobal) {
    throw forbidden("Not permitted (missing_permission)");
  }
  if (query.companyId && !viewable.includes(query.companyId) && !hasGlobal) {
    throw forbidden("Not permitted (no_company_scope)");
  }

  const admin = createAdminSupabase();
  let q = admin
    .from("audit_log")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(Math.min(query.limit ?? 100, 500));

  if (query.companyId) {
    q = q.eq("company_id", query.companyId);
  } else if (!hasGlobal) {
    q = q.in("company_id", viewable);
  }
  if (query.module) q = q.eq("module", query.module);

  const { data, error } = await q;
  if (error) throw internal();
  return data;
}
