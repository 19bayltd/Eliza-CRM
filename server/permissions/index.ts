import "server-only";

import { cache } from "react";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/server/auth/session";
import { forbidden } from "@/server/errors";
import {
  evaluatePermission,
  type AccessContext,
  type PermissionRequirement,
} from "@/server/permissions/evaluate";

/** Permission catalog (kept in sync with the reference-data migrations). */
export const PERMISSIONS = {
  companyView: "organization.company.view",
  companyCreate: "organization.company.create",
  companyUpdate: "organization.company.update",
  companyArchive: "organization.company.archive",
  branchManage: "organization.branch.manage",
  warehouseManage: "organization.warehouse.manage",
  departmentManage: "organization.department.manage",
  usersView: "users.view",
  usersInvite: "users.invite",
  usersUpdate: "users.update",
  usersSuspend: "users.suspend",
  usersRoleAssign: "users.role.assign",
  usersScopeAssign: "users.scope.assign",
  auditView: "audit.log.view",
  fileUpload: "storage.file.upload",
  fileDownload: "storage.file.download",
  // Phase 02 — product master
  productsView: "products.view",
  productsCreate: "products.create",
  productsUpdate: "products.update",
  productsArchive: "products.archive",
  productsCatalogManage: "products.catalog.manage",
  productsIntelligenceView: "products.intelligence.view",
  productsImport: "products.import",
  productsExport: "products.export",
  // Phase 03 — supplier management
  suppliersView: "suppliers.view",
  suppliersManage: "suppliers.manage",
  suppliersQuotationView: "suppliers.quotation.view",
  suppliersQuotationCostView: "suppliers.quotation.cost.view",
  suppliersQuotationManage: "suppliers.quotation.manage",
  suppliersDocumentDownload: "suppliers.document.download",
  suppliersDocumentManage: "suppliers.document.manage",
  purchasingRequestView: "purchasing.request.view",
  purchasingRequestManage: "purchasing.request.manage",
  purchasingRequestApprove: "purchasing.request.approve",
  purchasingRequestApproveHigh: "purchasing.request.approve.high",
  purchasingOrderView: "purchasing.order.view",
  purchasingOrderManage: "purchasing.order.manage",
  purchasingCostView: "purchasing.cost.view",
  purchasingReceive: "purchasing.receive",
  purchasingSampleView: "purchasing.sample.view",
  purchasingSampleManage: "purchasing.sample.manage",
  purchasingDocumentDownload: "purchasing.document.download",
  purchasingDocumentManage: "purchasing.document.manage",
  inventoryView: "inventory.view",
  inventoryMovementPost: "inventory.movement.post",
  inventoryTransferManage: "inventory.transfer.manage",
  inventoryTransferReceive: "inventory.transfer.receive",
  inventoryAdjustmentManage: "inventory.adjustment.manage",
  inventoryAdjustmentApprove: "inventory.adjustment.approve",
  inventoryCountManage: "inventory.count.manage",
  inventoryNegativeOverride: "inventory.negative.override",
  inventoryLocationManage: "inventory.location.manage",
  inventoryDocumentDownload: "inventory.document.download",
  inventoryDocumentManage: "inventory.document.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const PERMISSION_KEYS = new Set<string>(Object.values(PERMISSIONS));

/**
 * Narrow a database-sourced permission string to a known key. Approval
 * rules name their required permission as data; a rule pointing at an
 * unknown or misspelled key must fail closed rather than be treated as
 * satisfied, so callers refuse when this returns null.
 */
export function toPermissionKey(value: string): PermissionKey | null {
  return PERMISSION_KEYS.has(value) ? (value as PermissionKey) : null;
}

/**
 * Builds the caller's access context from the database. Reads run on the
 * service-role client because this is trusted authorization plumbing; the
 * result is cached per request. Never accepts client-supplied identifiers.
 */
export const getAccessContext = cache(async (): Promise<AccessContext> => {
  const session = await requireActiveUser();
  const admin = createAdminSupabase();

  const [companies, branches, warehouses, departments, userRoles] =
    await Promise.all([
      admin
        .from("user_company_scopes")
        .select("company_id")
        .eq("user_id", session.userId),
      admin
        .from("user_branch_scopes")
        .select("branch_id")
        .eq("user_id", session.userId),
      admin
        .from("user_warehouse_scopes")
        .select("warehouse_id")
        .eq("user_id", session.userId),
      admin
        .from("user_department_scopes")
        .select("department_id")
        .eq("user_id", session.userId),
      admin
        .from("user_roles")
        .select("company_id, roles(role_permissions(permissions(key)))")
        .eq("user_id", session.userId),
    ]);

  const roleGrants = (userRoles.data ?? []).map((row) => ({
    companyId: row.company_id,
    permissions: (row.roles?.role_permissions ?? [])
      .map((rp) => rp.permissions?.key)
      .filter((k): k is string => typeof k === "string"),
  }));

  return {
    userId: session.userId,
    accountStatus: session.profile.account_status,
    companyIds: (companies.data ?? []).map((r) => r.company_id),
    branchIds: (branches.data ?? []).map((r) => r.branch_id),
    warehouseIds: (warehouses.data ?? []).map((r) => r.warehouse_id),
    departmentIds: (departments.data ?? []).map((r) => r.department_id),
    roleGrants,
  };
});

/**
 * Central permission gate. Every privileged server operation calls this
 * (directly or via requireGlobalPermission) before touching data.
 * Throws ServiceError('forbidden') on denial; denial reasons are audited
 * by the calling service for sensitive actions.
 */
export async function requirePermission(
  req: PermissionRequirement & { permission: PermissionKey },
): Promise<AccessContext> {
  const ctx = await getAccessContext();
  const decision = evaluatePermission(ctx, req);
  if (!decision.allowed) {
    throw forbidden(`Not permitted (${decision.reason})`);
  }
  return ctx;
}

/** Global (cross-company) permission — e.g. creating a company. */
export async function requireGlobalPermission(
  permission: PermissionKey,
): Promise<AccessContext> {
  return requirePermission({ permission, requireGlobalGrant: true });
}

/** Non-throwing variant for permission-aware UI. */
export async function hasPermission(
  req: PermissionRequirement & { permission: PermissionKey },
): Promise<boolean> {
  try {
    const ctx = await getAccessContext();
    return evaluatePermission(ctx, req).allowed;
  } catch {
    return false;
  }
}
