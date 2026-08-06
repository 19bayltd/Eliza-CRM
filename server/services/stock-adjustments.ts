import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireActiveUser } from "@/server/auth/session";
import {
  getAccessContext,
  hasPermission,
  PERMISSIONS,
  requirePermission,
  toPermissionKey,
} from "@/server/permissions";
import { writeAudit } from "@/server/audit";
import { conflict, forbidden, internal, invalidInput, notFound } from "@/server/errors";
import { selectApprovalRule } from "@/server/validation/purchasing";
import {
  addAdjustmentLineSchema,
  adjustmentIdSchema,
  createAdjustmentSchema,
  decideAdjustmentSchema,
} from "@/server/validation/inventory";
import type { Tables } from "@/types/database";

/**
 * Stock adjustments — the only way stock changes without a physical
 * event, and therefore the only inventory flow that requires approval.
 *
 * Approval and posting are one guarded step: the ledger entries are
 * written at the moment of approval, so an approved adjustment can
 * neither sit unposted nor be posted twice.
 */

const ADJUSTMENT_ACTION = "stock_adjustment.approve";

export type AdjustmentLine = Tables<"stock_adjustment_lines"> & {
  productSku: string;
  variantSku: string | null;
};

export type AdjustmentDetail = {
  adjustment: Tables<"stock_adjustments"> & { warehouseCode: string };
  lines: AdjustmentLine[];
  approvals: Tables<"approval_records">[];
  canDecide: boolean;
  blockedBecause: string | null;
};

async function loadAdjustmentOr404(adjustmentId: string) {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("stock_adjustments")
    .select("*")
    .eq("id", adjustmentId)
    .maybeSingle();
  if (!data) throw notFound("Adjustment not found");
  return data;
}

async function resolveRule(companyId: string) {
  const admin = createAdminSupabase();
  const { data: rules, error } = await admin
    .from("approval_rules")
    .select("*")
    .eq("company_id", companyId)
    .eq("action", ADJUSTMENT_ACTION)
    .eq("active", true);
  if (error) throw internal();
  // Adjustments have no monetary amount, so they always match the base
  // tier; the engine is reused so the owner can add value tiers later.
  return selectApprovalRule(rules ?? [], "0");
}

export async function listAdjustments(
  companyId: string,
): Promise<(Tables<"stock_adjustments"> & { warehouseCode: string; lineCount: number })[]> {
  await requirePermission({ permission: PERMISSIONS.inventoryView, companyId });
  const supabase = await createServerSupabase();
  const [adjustments, lines] = await Promise.all([
    supabase
      .from("stock_adjustments")
      .select("*, warehouses!stock_adjustments_warehouse_id_fkey!inner(code)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase.from("stock_adjustment_lines").select("id, adjustment_id").eq("company_id", companyId),
  ]);
  if (adjustments.error || lines.error) throw internal();
  return (adjustments.data ?? []).map((row) => {
    const { warehouses, ...adjustment } = row;
    return {
      ...adjustment,
      warehouseCode: warehouses.code,
      lineCount: (lines.data ?? []).filter((l) => l.adjustment_id === adjustment.id).length,
    };
  });
}

export async function getAdjustmentDetail(adjustmentId: string): Promise<AdjustmentDetail> {
  const parsed = adjustmentIdSchema.safeParse({ adjustmentId });
  if (!parsed.success) throw invalidInput("Invalid identifier");
  const adjustment = await loadAdjustmentOr404(parsed.data.adjustmentId);
  await requirePermission({
    permission: PERMISSIONS.inventoryView,
    companyId: adjustment.company_id,
  });

  const admin = createAdminSupabase();
  const [warehouse, linesResult, approvalsResult] = await Promise.all([
    admin.from("warehouses").select("code").eq("id", adjustment.warehouse_id).single(),
    admin
      .from("stock_adjustment_lines")
      .select(
        "*, products!stock_adjustment_lines_product_id_fkey!inner(sku), product_variants!stock_adjustment_lines_variant_id_fkey(sku)",
      )
      .eq("adjustment_id", adjustment.id)
      .order("created_at"),
    admin
      .from("approval_records")
      .select("*")
      .eq("entity_id", adjustment.id)
      .order("created_at", { ascending: false }),
  ]);
  if (warehouse.error || linesResult.error || approvalsResult.error) throw internal();

  // Same two-reasons distinction as purchasing: being the requester is
  // not the same as lacking the authority.
  let canDecide = false;
  let blockedBecause: string | null = null;
  if (adjustment.status === "submitted") {
    const ctx = await getAccessContext();
    const requester = adjustment.submitted_by ?? adjustment.created_by;
    if (requester && requester === ctx.userId) {
      blockedBecause =
        "You submitted this adjustment, so you cannot approve it — the server refuses that regardless of permissions.";
    } else {
      const rule = await resolveRule(adjustment.company_id);
      const key = rule ? toPermissionKey(rule.required_permission) : null;
      const allowed = key
        ? await hasPermission({ permission: key, companyId: adjustment.company_id })
        : false;
      if (allowed) canDecide = true;
      else if (!rule || !key) {
        blockedBecause = "No approval rule covers stock adjustments in this company.";
      } else {
        blockedBecause = `Approving stock adjustments requires ${rule.required_permission}, which you do not hold.`;
      }
    }
  }

  return {
    adjustment: { ...adjustment, warehouseCode: warehouse.data.code },
    lines: (linesResult.data ?? []).map((row) => {
      const { products, product_variants, ...line } = row;
      return {
        ...line,
        productSku: products.sku,
        variantSku: product_variants?.sku ?? null,
      };
    }),
    approvals: approvalsResult.data ?? [],
    canDecide,
    blockedBecause,
  };
}

export async function createAdjustment(input: unknown): Promise<string> {
  const parsed = createAdjustmentSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await requirePermission({
    permission: PERMISSIONS.inventoryAdjustmentManage,
    companyId: parsed.data.companyId,
  });
  const session = await requireActiveUser();
  const admin = createAdminSupabase();

  const { data: warehouse } = await admin
    .from("warehouses")
    .select("id, company_id, code, status")
    .eq("id", parsed.data.warehouseId)
    .maybeSingle();
  if (!warehouse || warehouse.company_id !== parsed.data.companyId) {
    throw invalidInput("Warehouse does not belong to this company");
  }
  if (warehouse.status !== "active") {
    throw conflict("Archived warehouses cannot be adjusted");
  }

  const { data: number, error: numberError } = await admin.rpc("next_document_number", {
    p_company_id: parsed.data.companyId,
    p_doc_type: "ADJ",
  });
  if (numberError || !number) throw internal("Could not allocate an adjustment number");

  const { data: adjustment, error } = await admin
    .from("stock_adjustments")
    .insert({
      company_id: parsed.data.companyId,
      number,
      warehouse_id: warehouse.id,
      reason: parsed.data.reason,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id, number")
    .single();
  if (error || !adjustment) throw internal("Adjustment could not be created");

  await writeAudit({
    module: "inventory",
    action: "stock.adjustment_created",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId,
    entityType: "stock_adjustment",
    entityId: adjustment.id,
    newValue: { number: adjustment.number, warehouse: warehouse.code },
    reason: parsed.data.reason,
  });
  return adjustment.id;
}

export async function addAdjustmentLine(input: unknown): Promise<void> {
  const parsed = addAdjustmentLineSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const adjustment = await loadAdjustmentOr404(parsed.data.adjustmentId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.inventoryAdjustmentManage,
    companyId: adjustment.company_id,
  });
  if (adjustment.status !== "draft") {
    throw conflict("Lines can only be added while the adjustment is a draft");
  }

  const admin = createAdminSupabase();
  const { data: product } = await admin
    .from("products")
    .select("id, company_id, status")
    .eq("id", parsed.data.productId)
    .maybeSingle();
  if (!product || product.company_id !== adjustment.company_id) {
    throw invalidInput("Product does not belong to this company");
  }
  if (product.status === "archived") {
    throw conflict("Archived products cannot be adjusted");
  }
  if (parsed.data.variantId) {
    const { data: variant } = await admin
      .from("product_variants")
      .select("id, product_id, company_id")
      .eq("id", parsed.data.variantId)
      .maybeSingle();
    if (!variant || variant.company_id !== adjustment.company_id) {
      throw invalidInput("Variant does not belong to this company");
    }
    if (variant.product_id !== product.id) {
      throw invalidInput("Variant does not belong to the selected product");
    }
  }

  const { error } = await admin.from("stock_adjustment_lines").insert({
    company_id: adjustment.company_id,
    adjustment_id: adjustment.id,
    product_id: product.id,
    variant_id: parsed.data.variantId ?? null,
    quantity: parsed.data.quantity,
    note: parsed.data.note ?? null,
    created_by: ctx.userId,
    updated_by: ctx.userId,
  });
  if (error) throw internal("Line could not be added");
}

export async function submitAdjustment(input: unknown): Promise<void> {
  const parsed = adjustmentIdSchema.safeParse(input);
  if (!parsed.success) throw invalidInput("Invalid identifier");
  const adjustment = await loadAdjustmentOr404(parsed.data.adjustmentId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.inventoryAdjustmentManage,
    companyId: adjustment.company_id,
  });
  const session = await requireActiveUser();
  if (adjustment.status !== "draft") {
    throw conflict("Only draft adjustments can be submitted");
  }

  const admin = createAdminSupabase();
  const { count, error: countError } = await admin
    .from("stock_adjustment_lines")
    .select("id", { count: "exact", head: true })
    .eq("adjustment_id", adjustment.id);
  if (countError) throw internal();
  if (!count) throw conflict("Add at least one line before submitting");

  const { data: updated, error } = await admin
    .from("stock_adjustments")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      submitted_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .eq("id", adjustment.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) throw internal();
  if (!updated) throw conflict("The adjustment was already submitted");

  await admin.from("approval_records").insert({
    company_id: adjustment.company_id,
    module: "inventory",
    entity_type: "stock_adjustment",
    entity_id: adjustment.id,
    entity_number: adjustment.number,
    requested_by: ctx.userId,
    status: "pending",
    proposed_value: { line_count: count },
  });

  await writeAudit({
    module: "inventory",
    action: "stock.adjustment_submitted",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: adjustment.company_id,
    entityType: "stock_adjustment",
    entityId: adjustment.id,
    previousValue: { status: "draft" },
    newValue: { number: adjustment.number, status: "submitted", line_count: count },
  });
}

/**
 * Approve (and post) or reject. Approval writes the ledger entries in the
 * same call, so there is no window in which an adjustment is approved but
 * stock has not moved.
 */
export async function decideAdjustment(input: unknown): Promise<void> {
  const parsed = decideAdjustmentSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const adjustment = await loadAdjustmentOr404(parsed.data.adjustmentId);
  const session = await requireActiveUser();
  if (adjustment.status !== "submitted") {
    throw conflict("Only submitted adjustments can be decided");
  }

  const rule = await resolveRule(adjustment.company_id);
  const key = rule ? toPermissionKey(rule.required_permission) : null;
  if (!rule || !key) {
    throw conflict("No approval rule is configured for stock adjustments");
  }
  const ctx = await requirePermission({
    permission: key,
    companyId: adjustment.company_id,
  });

  const requester = adjustment.submitted_by ?? adjustment.created_by;
  if (requester && requester === ctx.userId) {
    await writeAudit({
      module: "inventory",
      action: "stock.adjustment_self_approval_refused",
      actorUserId: ctx.userId,
      actorEmail: session.email,
      companyId: adjustment.company_id,
      entityType: "stock_adjustment",
      entityId: adjustment.id,
      newValue: { number: adjustment.number },
      result: "failure",
    });
    throw forbidden("You cannot approve your own adjustment");
  }

  if (parsed.data.allowNegative) {
    await requirePermission({
      permission: PERMISSIONS.inventoryNegativeOverride,
      companyId: adjustment.company_id,
    });
  }

  const admin = createAdminSupabase();
  const decidedAt = new Date().toISOString();

  // Claim the decision first so two approvers cannot both post.
  const { data: claimed, error: claimError } = await admin
    .from("stock_adjustments")
    .update({
      status: parsed.data.decision,
      decided_at: decidedAt,
      decided_by: ctx.userId,
      decision_reason: parsed.data.reason,
      rule_applied: rule.required_permission,
      updated_by: ctx.userId,
    })
    .eq("id", adjustment.id)
    .eq("status", "submitted")
    .select("id")
    .maybeSingle();
  if (claimError) throw internal();
  if (!claimed) throw conflict("The adjustment was already decided");

  let postedEntries = 0;
  if (parsed.data.decision === "approved") {
    const { data: lines, error: linesError } = await admin
      .from("stock_adjustment_lines")
      .select("*")
      .eq("adjustment_id", adjustment.id);
    if (linesError) throw internal();

    const { error } = await admin.rpc("post_stock_entries", {
      p_company_id: adjustment.company_id,
      p_entries: (lines ?? []).map((l) => ({
        warehouse_id: adjustment.warehouse_id,
        product_id: l.product_id,
        variant_id: l.variant_id,
        txn_type: "adjustment",
        quantity: l.quantity,
        reference_type: "stock_adjustment",
        reference_id: adjustment.id,
        reference_number: adjustment.number,
        reason: adjustment.reason,
      })),
      p_actor: ctx.userId,
      p_allow_negative: parsed.data.allowNegative,
    });
    if (error) {
      // Posting failed, so the approval must not stand: return it to
      // submitted and surface why.
      await admin
        .from("stock_adjustments")
        .update({ status: "submitted", decided_at: null, decided_by: null, rule_applied: null })
        .eq("id", adjustment.id);
      if ((error.message ?? "").includes("Insufficient stock")) {
        throw conflict(error.message.replace(/^.*?Insufficient/, "Insufficient"));
      }
      throw internal("The adjustment could not be posted to the ledger");
    }
    postedEntries = (lines ?? []).length;
  }

  await admin
    .from("approval_records")
    .update({
      approver_id: ctx.userId,
      decided_at: decidedAt,
      status: parsed.data.decision,
      rule_applied: rule.required_permission,
      reason: parsed.data.reason,
    })
    .eq("entity_id", adjustment.id)
    .eq("status", "pending");

  await writeAudit({
    module: "inventory",
    action:
      parsed.data.decision === "approved"
        ? "stock.adjustment_approved"
        : "stock.adjustment_rejected",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: adjustment.company_id,
    entityType: "stock_adjustment",
    entityId: adjustment.id,
    previousValue: { status: "submitted" },
    newValue: {
      number: adjustment.number,
      status: parsed.data.decision,
      rule_applied: rule.required_permission,
      entries_posted: postedEntries,
    },
    reason: parsed.data.reason,
  });

  await writeAudit({
    module: "inventory",
    action: "approval.recorded",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: adjustment.company_id,
    entityType: "stock_adjustment",
    entityId: adjustment.id,
    newValue: { number: adjustment.number, decision: parsed.data.decision },
    reason: parsed.data.reason,
  });

  if (parsed.data.allowNegative && parsed.data.decision === "approved") {
    await writeAudit({
      module: "inventory",
      action: "stock.negative_override_used",
      actorUserId: ctx.userId,
      actorEmail: session.email,
      companyId: adjustment.company_id,
      entityType: "stock_adjustment",
      entityId: adjustment.id,
      newValue: { number: adjustment.number, entries: postedEntries },
      reason: parsed.data.reason,
      result: "failure",
    });
  }
}
