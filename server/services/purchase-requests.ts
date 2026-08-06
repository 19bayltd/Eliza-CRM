import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireActiveUser } from "@/server/auth/session";
import {
  hasPermission,
  PERMISSIONS,
  requirePermission,
  toPermissionKey,
} from "@/server/permissions";
import { writeAudit } from "@/server/audit";
import { conflict, forbidden, internal, invalidInput, notFound } from "@/server/errors";
import {
  addRequestLineSchema,
  cancelRequestSchema,
  createRequestSchema,
  decideRequestSchema,
  requestIdSchema,
  selectApprovalRule,
  sumLineTotals,
  updateRequestSchema,
} from "@/server/validation/purchasing";
import type { Tables } from "@/types/database";

/**
 * Purchase requests and the approval engine.
 *
 * Two rules shape this file:
 *  - The total is frozen at submission, so an approver's decision is
 *    always bound to the amount they actually saw. Editing lines after
 *    submission is impossible; the request must be cancelled and redone.
 *  - Approval requirements come from `approval_rules` rows, never from
 *    constants here, so thresholds change without a deployment.
 */

export type RequestLine = Tables<"purchase_request_lines"> & {
  productSku: string;
  variantSku: string | null;
  lineTotal: string;
};

export type RequestDetail = {
  request: Tables<"purchase_requests">;
  lines: RequestLine[];
  currentTotal: string;
  approvals: Tables<"approval_records">[];
};

const REQUEST_ACTION = "purchase_request.approve";

async function loadRequestOr404(requestId: string) {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("purchase_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (!data) throw notFound("Purchase request not found");
  return data;
}

export async function listRequests(
  companyId: string,
): Promise<(Tables<"purchase_requests"> & { lineCount: number })[]> {
  await requirePermission({
    permission: PERMISSIONS.purchasingRequestView,
    companyId,
  });
  const supabase = await createServerSupabase();
  const [requests, lines] = await Promise.all([
    supabase
      .from("purchase_requests")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase.from("purchase_request_lines").select("id, request_id").eq("company_id", companyId),
  ]);
  if (requests.error || lines.error) throw internal();
  return requests.data.map((r) => ({
    ...r,
    lineCount: (lines.data ?? []).filter((l) => l.request_id === r.id).length,
  }));
}

export async function getRequestDetail(requestId: string): Promise<RequestDetail> {
  const parsed = requestIdSchema.safeParse({ requestId });
  if (!parsed.success) throw invalidInput("Invalid identifier");
  const request = await loadRequestOr404(parsed.data.requestId);
  await requirePermission({
    permission: PERMISSIONS.purchasingRequestView,
    companyId: request.company_id,
  });

  const admin = createAdminSupabase();
  const [linesResult, approvalsResult] = await Promise.all([
    admin
      .from("purchase_request_lines")
      .select(
        "*, products!purchase_request_lines_product_id_fkey!inner(sku), product_variants(sku)",
      )
      .eq("request_id", request.id)
      .order("created_at"),
    admin
      .from("approval_records")
      .select("*")
      .eq("entity_id", request.id)
      .order("created_at", { ascending: false }),
  ]);
  if (linesResult.error || approvalsResult.error) throw internal();

  const lines = (linesResult.data ?? []).map((row) => {
    const { products, product_variants, ...line } = row;
    return {
      ...line,
      productSku: products.sku,
      variantSku: product_variants?.sku ?? null,
      lineTotal: sumLineTotals([
        { quantity: line.quantity, unitPrice: String(line.estimated_unit_price) },
      ]),
    };
  });

  return {
    request,
    lines,
    currentTotal: sumLineTotals(
      lines.map((l) => ({
        quantity: l.quantity,
        unitPrice: String(l.estimated_unit_price),
      })),
    ),
    approvals: approvalsResult.data ?? [],
  };
}

export async function createRequest(input: unknown): Promise<string> {
  const parsed = createRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingRequestManage,
    companyId: parsed.data.companyId,
  });
  const session = await requireActiveUser();
  const admin = createAdminSupabase();

  const { data: number, error: numberError } = await admin.rpc("next_document_number", {
    p_company_id: parsed.data.companyId,
    p_doc_type: "PR",
  });
  if (numberError || !number) throw internal("Could not allocate a request number");

  const { data: request, error } = await admin
    .from("purchase_requests")
    .insert({
      company_id: parsed.data.companyId,
      number,
      title: parsed.data.title,
      justification: parsed.data.justification ?? null,
      needed_by: parsed.data.neededBy ?? null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id, number")
    .single();
  if (error || !request) throw internal("Request could not be created");

  await writeAudit({
    module: "purchasing",
    action: "purchase_request.created",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId,
    entityType: "purchase_request",
    entityId: request.id,
    newValue: { number: request.number, title: parsed.data.title },
  });
  return request.id;
}

export async function updateRequest(input: unknown): Promise<void> {
  const parsed = updateRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const request = await loadRequestOr404(parsed.data.requestId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingRequestManage,
    companyId: request.company_id,
  });
  const session = await requireActiveUser();
  if (request.status !== "draft") {
    throw conflict("Only draft requests can be edited");
  }

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("purchase_requests")
    .update({
      title: parsed.data.title,
      justification: parsed.data.justification ?? null,
      needed_by: parsed.data.neededBy ?? null,
      updated_by: ctx.userId,
    })
    .eq("id", request.id)
    .eq("status", "draft");
  if (error) throw internal();

  await writeAudit({
    module: "purchasing",
    action: "purchase_request.updated",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: request.company_id,
    entityType: "purchase_request",
    entityId: request.id,
    previousValue: { title: request.title },
    newValue: { number: request.number, title: parsed.data.title },
  });
}

export async function addRequestLine(input: unknown): Promise<void> {
  const parsed = addRequestLineSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const request = await loadRequestOr404(parsed.data.requestId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingRequestManage,
    companyId: request.company_id,
  });
  const session = await requireActiveUser();
  if (request.status !== "draft") {
    throw conflict("Lines can only be added while the request is a draft");
  }

  const admin = createAdminSupabase();
  const { data: product } = await admin
    .from("products")
    .select("id, company_id, sku, status")
    .eq("id", parsed.data.productId)
    .maybeSingle();
  if (!product || product.company_id !== request.company_id) {
    throw invalidInput("Product does not belong to this company");
  }
  if (product.status === "archived") {
    throw conflict("Archived products cannot be requested");
  }

  if (parsed.data.variantId) {
    const { data: variant } = await admin
      .from("product_variants")
      .select("id, product_id, company_id")
      .eq("id", parsed.data.variantId)
      .maybeSingle();
    if (!variant || variant.company_id !== request.company_id) {
      throw invalidInput("Variant does not belong to this company");
    }
    if (variant.product_id !== product.id) {
      throw invalidInput("Variant does not belong to the selected product");
    }
  }

  const { error } = await admin.from("purchase_request_lines").insert({
    company_id: request.company_id,
    request_id: request.id,
    product_id: product.id,
    variant_id: parsed.data.variantId ?? null,
    quantity: parsed.data.quantity,
    // Validated decimal string — never a float.
    estimated_unit_price: parsed.data.estimatedUnitPrice as unknown as number,
    notes: parsed.data.notes ?? null,
    created_by: ctx.userId,
    updated_by: ctx.userId,
  });
  if (error) throw internal("Line could not be added");

  await writeAudit({
    module: "purchasing",
    action: "purchase_request.updated",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: request.company_id,
    entityType: "purchase_request",
    entityId: request.id,
    newValue: { number: request.number, line_added: product.sku, quantity: parsed.data.quantity },
  });
}

/** Submit for approval: freezes the total the approver will judge. */
export async function submitRequest(input: unknown): Promise<void> {
  const parsed = requestIdSchema.safeParse(input);
  if (!parsed.success) throw invalidInput("Invalid identifier");
  const request = await loadRequestOr404(parsed.data.requestId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingRequestManage,
    companyId: request.company_id,
  });
  const session = await requireActiveUser();
  if (request.status !== "draft") {
    throw conflict("Only draft requests can be submitted");
  }

  const admin = createAdminSupabase();
  const { data: lines, error: linesError } = await admin
    .from("purchase_request_lines")
    .select("quantity, estimated_unit_price")
    .eq("request_id", request.id);
  if (linesError) throw internal();
  if (!lines || lines.length === 0) {
    throw conflict("Add at least one line before submitting");
  }

  const total = sumLineTotals(
    lines.map((l) => ({ quantity: l.quantity, unitPrice: String(l.estimated_unit_price) })),
  );

  // Guarded by status so two submissions cannot both freeze a total.
  const { data: updated, error } = await admin
    .from("purchase_requests")
    .update({
      status: "submitted",
      // Validated decimal string — never a float.
      submitted_total: total as unknown as number,
      submitted_at: new Date().toISOString(),
      submitted_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .eq("id", request.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) throw internal();
  if (!updated) throw conflict("The request was already submitted");

  const { error: approvalError } = await admin.from("approval_records").insert({
    company_id: request.company_id,
    module: "purchasing",
    entity_type: "purchase_request",
    entity_id: request.id,
    entity_number: request.number,
    requested_by: ctx.userId,
    status: "pending",
    proposed_value: { line_count: lines.length },
  });
  if (approvalError) throw internal("Approval record could not be created");

  await writeAudit({
    module: "purchasing",
    action: "purchase_request.submitted",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: request.company_id,
    entityType: "purchase_request",
    entityId: request.id,
    previousValue: { status: "draft" },
    newValue: { number: request.number, status: "submitted", line_count: lines.length },
  });
}

/**
 * Resolve which permission an approval needs, from data. Returns the
 * rule so callers can record which one applied.
 */
export async function resolveApprovalRule(params: {
  companyId: string;
  amount: string;
}): Promise<Tables<"approval_rules"> | null> {
  const admin = createAdminSupabase();
  const { data: rules, error } = await admin
    .from("approval_rules")
    .select("*")
    .eq("company_id", params.companyId)
    .eq("action", REQUEST_ACTION)
    .eq("active", true);
  if (error) throw internal();
  return selectApprovalRule(rules ?? [], params.amount);
}

/** Approve or reject. Requesters can never decide their own request. */
export async function decideRequest(input: unknown): Promise<void> {
  const parsed = decideRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const request = await loadRequestOr404(parsed.data.requestId);
  const session = await requireActiveUser();

  if (request.status !== "submitted") {
    throw conflict("Only submitted requests can be decided");
  }

  const amount = String(request.submitted_total ?? "0");
  const rule = await resolveApprovalRule({ companyId: request.company_id, amount });
  if (!rule) {
    // No rule matched: refuse rather than fall back to a default
    // permission — an unconfigured threshold must not become an
    // unguarded approval.
    throw conflict("No approval rule is configured for this amount");
  }

  // A rule naming an unknown permission fails closed rather than being
  // treated as satisfied.
  const requiredPermission = toPermissionKey(rule.required_permission);
  if (!requiredPermission) {
    throw conflict("The approval rule for this amount is misconfigured");
  }
  const ctx = await requirePermission({
    permission: requiredPermission,
    companyId: request.company_id,
  });

  // Self-approval is refused regardless of permissions held, and the
  // attempt is recorded: separation of duties is the point of approval.
  const requester = request.submitted_by ?? request.created_by;
  if (requester && requester === ctx.userId) {
    await writeAudit({
      module: "purchasing",
      action: "purchase_request.self_approval_refused",
      actorUserId: ctx.userId,
      actorEmail: session.email,
      companyId: request.company_id,
      entityType: "purchase_request",
      entityId: request.id,
      newValue: { number: request.number },
      result: "failure",
    });
    throw forbidden("You cannot decide your own request");
  }

  const admin = createAdminSupabase();
  const decidedAt = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("purchase_requests")
    .update({
      status: parsed.data.decision,
      decided_at: decidedAt,
      decided_by: ctx.userId,
      decision_reason: parsed.data.reason,
      rule_applied: rule.required_permission,
      updated_by: ctx.userId,
    })
    .eq("id", request.id)
    .eq("status", "submitted")
    .select("id")
    .maybeSingle();
  if (error) throw internal();
  if (!updated) throw conflict("The request was already decided");

  await admin
    .from("approval_records")
    .update({
      approver_id: ctx.userId,
      decided_at: decidedAt,
      status: parsed.data.decision,
      rule_applied: rule.required_permission,
      reason: parsed.data.reason,
    })
    .eq("entity_id", request.id)
    .eq("status", "pending");

  await writeAudit({
    module: "purchasing",
    action:
      parsed.data.decision === "approved"
        ? "purchase_request.approved"
        : "purchase_request.rejected",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: request.company_id,
    entityType: "purchase_request",
    entityId: request.id,
    previousValue: { status: "submitted" },
    newValue: {
      number: request.number,
      status: parsed.data.decision,
      rule_applied: rule.required_permission,
    },
    reason: parsed.data.reason,
  });

  await writeAudit({
    module: "purchasing",
    action: "approval.recorded",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: request.company_id,
    entityType: "purchase_request",
    entityId: request.id,
    newValue: {
      number: request.number,
      decision: parsed.data.decision,
      rule_applied: rule.required_permission,
    },
    reason: parsed.data.reason,
  });
}

export async function cancelRequest(input: unknown): Promise<void> {
  const parsed = cancelRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const request = await loadRequestOr404(parsed.data.requestId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingRequestManage,
    companyId: request.company_id,
  });
  const session = await requireActiveUser();
  if (!["draft", "submitted"].includes(request.status)) {
    throw conflict("Only draft or submitted requests can be cancelled");
  }

  const admin = createAdminSupabase();
  const { data: updated, error } = await admin
    .from("purchase_requests")
    .update({
      status: "cancelled",
      decision_reason: parsed.data.reason,
      updated_by: ctx.userId,
    })
    .eq("id", request.id)
    .in("status", ["draft", "submitted"])
    .select("id")
    .maybeSingle();
  if (error) throw internal();
  if (!updated) throw conflict("The request is no longer cancellable");

  await admin
    .from("approval_records")
    .update({ status: "rejected", reason: parsed.data.reason, decided_at: new Date().toISOString() })
    .eq("entity_id", request.id)
    .eq("status", "pending");

  await writeAudit({
    module: "purchasing",
    action: "purchase_request.cancelled",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: request.company_id,
    entityType: "purchase_request",
    entityId: request.id,
    previousValue: { status: request.status },
    newValue: { number: request.number, status: "cancelled" },
    reason: parsed.data.reason,
  });
}

/** Whether the acting user may decide this request (for UI gating). */
export async function canDecideRequest(
  request: Tables<"purchase_requests">,
): Promise<boolean> {
  if (request.status !== "submitted") return false;
  const rule = await resolveApprovalRule({
    companyId: request.company_id,
    amount: String(request.submitted_total ?? "0"),
  });
  if (!rule) return false;
  const requiredPermission = toPermissionKey(rule.required_permission);
  if (!requiredPermission) return false;
  return hasPermission({
    permission: requiredPermission,
    companyId: request.company_id,
  });
}
