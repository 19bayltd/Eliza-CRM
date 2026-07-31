/**
 * Pure authorization evaluator — no I/O, fully unit-testable.
 * The database-backed wrapper in ./index.ts builds an AccessContext and
 * delegates every decision here, so the rules live in exactly one place.
 */

export type AccountStatus =
  | "invited"
  | "active"
  | "suspended"
  | "locked"
  | "disabled"
  | "exited";

export type RoleGrant = {
  /** null = global grant (applies in every company the user has scope for) */
  companyId: string | null;
  permissions: readonly string[];
};

export type AccessContext = {
  userId: string;
  accountStatus: AccountStatus;
  companyIds: readonly string[];
  branchIds: readonly string[];
  warehouseIds: readonly string[];
  departmentIds: readonly string[];
  roleGrants: readonly RoleGrant[];
};

export type PermissionRequirement = {
  permission: string;
  /** Company the target record belongs to. Omit only for global checks. */
  companyId?: string;
  /** Require a global (company_id null) role grant, e.g. company creation. */
  requireGlobalGrant?: boolean;
  branchId?: string;
  warehouseId?: string;
  departmentId?: string;
};

export type Decision =
  | { allowed: true }
  | { allowed: false; reason: string };

export function evaluatePermission(
  ctx: AccessContext,
  req: PermissionRequirement,
): Decision {
  if (ctx.accountStatus !== "active") {
    return { allowed: false, reason: `account_${ctx.accountStatus}` };
  }

  if (req.requireGlobalGrant) {
    const hasGlobal = ctx.roleGrants.some(
      (g) => g.companyId === null && g.permissions.includes(req.permission),
    );
    return hasGlobal
      ? { allowed: true }
      : { allowed: false, reason: "missing_global_permission" };
  }

  if (!req.companyId) {
    return { allowed: false, reason: "missing_company_target" };
  }

  if (!ctx.companyIds.includes(req.companyId)) {
    return { allowed: false, reason: "no_company_scope" };
  }

  const companyId = req.companyId;
  const hasPermission = ctx.roleGrants.some(
    (g) =>
      (g.companyId === null || g.companyId === companyId) &&
      g.permissions.includes(req.permission),
  );
  if (!hasPermission) {
    return { allowed: false, reason: "missing_permission" };
  }

  // Narrow scopes apply only when the user holds any grants of that kind:
  // an empty branch-scope list means "not branch-restricted" in Phase 01.
  if (
    req.branchId &&
    ctx.branchIds.length > 0 &&
    !ctx.branchIds.includes(req.branchId)
  ) {
    return { allowed: false, reason: "no_branch_scope" };
  }
  if (
    req.warehouseId &&
    ctx.warehouseIds.length > 0 &&
    !ctx.warehouseIds.includes(req.warehouseId)
  ) {
    return { allowed: false, reason: "no_warehouse_scope" };
  }
  if (
    req.departmentId &&
    ctx.departmentIds.length > 0 &&
    !ctx.departmentIds.includes(req.departmentId)
  ) {
    return { allowed: false, reason: "no_department_scope" };
  }

  return { allowed: true };
}
