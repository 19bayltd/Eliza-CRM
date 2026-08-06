import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireActiveUser } from "@/server/auth/session";
import { hasPermission, PERMISSIONS, requirePermission } from "@/server/permissions";
import { writeAudit } from "@/server/audit";
import { conflict, internal, invalidInput, notFound } from "@/server/errors";
import {
  addOrderLineSchema,
  cancelOrderSchema,
  createOrderSchema,
  ISSUE_BLOCK_MESSAGE,
  issueBlockReason,
  orderIdSchema,
  recordReceiptSchema,
  setOrderWarehouseSchema,
  sumLineTotals,
} from "@/server/validation/purchasing";
import type { Tables } from "@/types/database";

/**
 * Purchase orders, their walled line costs, and receiving.
 *
 * Prices live in `purchase_order_line_costs`, which is RLS deny-all: the
 * only way to read a price is through this service, which checks
 * `purchasing.cost.view` and audits the exposure. Callers without that
 * permission receive lines with `unitPrice: null` — the price is never
 * fetched for them, so masking cannot be undone client-side.
 */

export type OrderLine = Tables<"purchase_order_lines"> & {
  productSku: string;
  variantSku: string | null;
  unitPrice: string | null;
  lineTotal: string | null;
  receivedAccepted: number;
};

export type OrderDetail = {
  order: Tables<"purchase_orders"> & {
    supplierCode: string;
    supplierName: string;
    warehouseCode: string | null;
    warehouseName: string | null;
    warehouseStatus: string | null;
  };
  lines: OrderLine[];
  total: string | null;
  receipts: (Tables<"purchase_receipts"> & { lineCount: number })[];
  canSeeCosts: boolean;
  /** Null when the order can be issued; otherwise why it cannot. */
  issueBlock: ReturnType<typeof issueBlockReason>;
};

async function loadOrderOr404(orderId: string) {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("purchase_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (!data) throw notFound("Purchase order not found");
  return data;
}

/**
 * Resolve a destination warehouse for an order, applying the same rules
 * wherever a destination is set. Both callers used to carry their own
 * copy of these checks, which is how they can drift apart.
 *
 * Company membership is also enforced by the composite foreign key
 * `purchase_orders_warehouse_company_fkey`; this check exists so the
 * caller gets a sentence rather than a constraint violation.
 */
async function resolveDestination(companyId: string, warehouseId: string) {
  const admin = createAdminSupabase();
  const { data: warehouse } = await admin
    .from("warehouses")
    .select("id, company_id, code, status")
    .eq("id", warehouseId)
    .maybeSingle();
  if (!warehouse || warehouse.company_id !== companyId) {
    throw invalidInput("Warehouse does not belong to this company");
  }
  if (warehouse.status !== "active") {
    throw conflict("Archived warehouses cannot receive purchase orders");
  }
  return warehouse;
}

export async function listOrders(
  companyId: string,
): Promise<
  (Tables<"purchase_orders"> & {
    supplierCode: string;
    warehouseCode: string | null;
    lineCount: number;
  })[]
> {
  await requirePermission({ permission: PERMISSIONS.purchasingOrderView, companyId });
  const supabase = await createServerSupabase();
  const [orders, lines] = await Promise.all([
    supabase
      .from("purchase_orders")
      // Two foreign keys reach warehouses (plain and company-composite), so
      // the destination embed names the one it means — an unhinted embed
      // returns HTTP 300 rather than rows.
      .select(
        "*, suppliers!purchase_orders_supplier_id_fkey!inner(code), warehouses!purchase_orders_warehouse_id_fkey(code)",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase.from("purchase_order_lines").select("id, order_id").eq("company_id", companyId),
  ]);
  if (orders.error || lines.error) throw internal();
  return (orders.data ?? []).map((row) => {
    const { suppliers, warehouses, ...order } = row;
    return {
      ...order,
      supplierCode: suppliers.code,
      warehouseCode: warehouses?.code ?? null,
      lineCount: (lines.data ?? []).filter((l) => l.order_id === order.id).length,
    };
  });
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
  const parsed = orderIdSchema.safeParse({ orderId });
  if (!parsed.success) throw invalidInput("Invalid identifier");
  const order = await loadOrderOr404(parsed.data.orderId);
  await requirePermission({
    permission: PERMISSIONS.purchasingOrderView,
    companyId: order.company_id,
  });
  const canSeeCosts = await hasPermission({
    permission: PERMISSIONS.purchasingCostView,
    companyId: order.company_id,
  });

  const admin = createAdminSupabase();
  const [supplierResult, warehouseResult, linesResult, receiptsResult] = await Promise.all([
    admin.from("suppliers").select("code, name").eq("id", order.supplier_id).single(),
    order.warehouse_id
      ? admin
          .from("warehouses")
          .select("code, name, status")
          .eq("id", order.warehouse_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin
      .from("purchase_order_lines")
      .select(
        "*, products!purchase_order_lines_product_id_fkey!inner(sku), product_variants!purchase_order_lines_variant_id_fkey(sku)",
      )
      .eq("order_id", order.id)
      .order("created_at"),
    admin
      .from("purchase_receipts")
      .select("*, purchase_receipt_lines!purchase_receipt_lines_receipt_id_fkey(id)")
      .eq("order_id", order.id)
      .order("received_at", { ascending: false }),
  ]);
  if (
    supplierResult.error ||
    warehouseResult.error ||
    linesResult.error ||
    receiptsResult.error
  ) {
    throw internal();
  }

  const lineIds = (linesResult.data ?? []).map((l) => l.id);

  // Costs are fetched only for permitted callers, and the read is audited.
  let costsById = new Map<string, string>();
  if (canSeeCosts && lineIds.length > 0) {
    const { data: costs, error } = await admin
      .from("purchase_order_line_costs")
      .select("line_id, unit_price")
      .in("line_id", lineIds);
    if (error) throw internal();
    costsById = new Map((costs ?? []).map((c) => [c.line_id, String(c.unit_price)]));
  }

  // Accepted quantities per line, across every receipt for this order.
  const { data: receiptLines, error: receiptLinesError } = await admin
    .from("purchase_receipt_lines")
    .select("order_line_id, accepted_qty")
    .in("order_line_id", lineIds.length > 0 ? lineIds : ["00000000-0000-0000-0000-000000000000"]);
  if (receiptLinesError) throw internal();

  const lines: OrderLine[] = (linesResult.data ?? []).map((row) => {
    const { products, product_variants, ...line } = row;
    const unitPrice = costsById.get(line.id) ?? null;
    return {
      ...line,
      productSku: products.sku,
      variantSku: product_variants?.sku ?? null,
      unitPrice,
      lineTotal: unitPrice
        ? sumLineTotals([{ quantity: line.quantity_ordered, unitPrice }])
        : null,
      receivedAccepted: (receiptLines ?? [])
        .filter((r) => r.order_line_id === line.id)
        .reduce((sum, r) => sum + r.accepted_qty, 0),
    };
  });

  if (canSeeCosts && costsById.size > 0) {
    const session = await requireActiveUser();
    await writeAudit({
      module: "purchasing",
      action: "purchase_order.cost_viewed",
      actorEmail: session.email,
      companyId: order.company_id,
      entityType: "purchase_order",
      entityId: order.id,
      // A count, never the values.
      newValue: { lines_with_prices: costsById.size },
    });
  }

  const total = canSeeCosts
    ? sumLineTotals(
        lines
          .filter((l) => l.unitPrice)
          .map((l) => ({ quantity: l.quantity_ordered, unitPrice: l.unitPrice! })),
      )
    : null;

  return {
    order: {
      ...order,
      supplierCode: supplierResult.data.code,
      supplierName: supplierResult.data.name,
      warehouseCode: warehouseResult.data?.code ?? null,
      warehouseName: warehouseResult.data?.name ?? null,
      warehouseStatus: warehouseResult.data?.status ?? null,
    },
    lines,
    total,
    receipts: (receiptsResult.data ?? []).map((row) => {
      const { purchase_receipt_lines: rl, ...receipt } = row;
      return { ...receipt, lineCount: (rl ?? []).length };
    }),
    canSeeCosts,
    issueBlock: issueBlockReason({
      status: order.status,
      lineCount: lines.length,
      warehouseId: order.warehouse_id,
      warehouseStatus: warehouseResult.data?.status ?? null,
    }),
  };
}

/** Creating an order commits money, so it needs cost.view as well. */
export async function createOrder(input: unknown): Promise<string> {
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingOrderManage,
    companyId: parsed.data.companyId,
  });
  await requirePermission({
    permission: PERMISSIONS.purchasingCostView,
    companyId: parsed.data.companyId,
  });
  const session = await requireActiveUser();
  const admin = createAdminSupabase();

  const { data: supplier } = await admin
    .from("suppliers")
    .select("id, company_id, code, status")
    .eq("id", parsed.data.supplierId)
    .maybeSingle();
  if (!supplier || supplier.company_id !== parsed.data.companyId) {
    throw invalidInput("Supplier does not belong to this company");
  }
  if (supplier.status === "archived") {
    throw conflict("Archived suppliers cannot receive purchase orders");
  }

  if (parsed.data.requestId) {
    const { data: request } = await admin
      .from("purchase_requests")
      .select("id, company_id, status")
      .eq("id", parsed.data.requestId)
      .maybeSingle();
    if (!request || request.company_id !== parsed.data.companyId) {
      throw invalidInput("Request does not belong to this company");
    }
    if (request.status !== "approved") {
      throw conflict("Only approved requests can become purchase orders");
    }
  }

  // A destination is optional while drafting: a company that has not
  // created a warehouse yet must still be able to start an order. It is
  // checked here only if one was chosen, and required at issue.
  const warehouse = parsed.data.warehouseId
    ? await resolveDestination(parsed.data.companyId, parsed.data.warehouseId)
    : null;

  const { data: number, error: numberError } = await admin.rpc("next_document_number", {
    p_company_id: parsed.data.companyId,
    p_doc_type: "PO",
  });
  if (numberError || !number) throw internal("Could not allocate an order number");

  const { data: order, error } = await admin
    .from("purchase_orders")
    .insert({
      company_id: parsed.data.companyId,
      number,
      supplier_id: supplier.id,
      warehouse_id: warehouse?.id ?? null,
      request_id: parsed.data.requestId ?? null,
      currency: parsed.data.currency,
      // Validated decimal string — never a float.
      exchange_rate: parsed.data.exchangeRate as unknown as number,
      expected_date: parsed.data.expectedDate ?? null,
      terms: parsed.data.terms ?? null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id, number")
    .single();
  if (error || !order) throw internal("Order could not be created");

  await writeAudit({
    module: "purchasing",
    action: "purchase_order.created",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId,
    entityType: "purchase_order",
    entityId: order.id,
    newValue: {
      number: order.number,
      supplier: supplier.code,
      currency: parsed.data.currency,
    },
  });
  return order.id;
}

export async function addOrderLine(input: unknown): Promise<void> {
  const parsed = addOrderLineSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const order = await loadOrderOr404(parsed.data.orderId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingOrderManage,
    companyId: order.company_id,
  });
  await requirePermission({
    permission: PERMISSIONS.purchasingCostView,
    companyId: order.company_id,
  });
  const session = await requireActiveUser();
  if (order.status !== "draft") {
    throw conflict("Lines can only be added while the order is a draft");
  }

  const admin = createAdminSupabase();
  const { data: product } = await admin
    .from("products")
    .select("id, company_id, sku, status")
    .eq("id", parsed.data.productId)
    .maybeSingle();
  if (!product || product.company_id !== order.company_id) {
    throw invalidInput("Product does not belong to this company");
  }
  if (product.status === "archived") {
    throw conflict("Archived products cannot be ordered");
  }
  if (parsed.data.variantId) {
    const { data: variant } = await admin
      .from("product_variants")
      .select("id, product_id, company_id")
      .eq("id", parsed.data.variantId)
      .maybeSingle();
    if (!variant || variant.company_id !== order.company_id) {
      throw invalidInput("Variant does not belong to this company");
    }
    if (variant.product_id !== product.id) {
      throw invalidInput("Variant does not belong to the selected product");
    }
  }

  const { data: line, error } = await admin
    .from("purchase_order_lines")
    .insert({
      company_id: order.company_id,
      order_id: order.id,
      product_id: product.id,
      variant_id: parsed.data.variantId ?? null,
      quantity_ordered: parsed.data.quantity,
      notes: parsed.data.notes ?? null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !line) throw internal("Line could not be added");

  const { error: costError } = await admin.from("purchase_order_line_costs").insert({
    line_id: line.id,
    company_id: order.company_id,
    // Validated decimal string — never a float.
    unit_price: parsed.data.unitPrice as unknown as number,
    created_by: ctx.userId,
    updated_by: ctx.userId,
  });
  if (costError) {
    // Compensate: a line without its price would be an order we cannot
    // price. Failure to compensate is itself audited, never swallowed.
    const { error: cleanupError } = await admin
      .from("purchase_order_lines")
      .delete()
      .eq("id", line.id);
    if (cleanupError) {
      await writeAudit({
        module: "purchasing",
        action: "purchase_order.orphan_cleanup_failed",
        actorUserId: ctx.userId,
        actorEmail: session.email,
        companyId: order.company_id,
        entityType: "purchase_order",
        entityId: order.id,
        newValue: { number: order.number, line_id: line.id },
        result: "failure",
      });
    }
    throw internal("Line price could not be stored");
  }

  await writeAudit({
    module: "purchasing",
    action: "purchase_order.created",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: order.company_id,
    entityType: "purchase_order",
    entityId: order.id,
    newValue: {
      number: order.number,
      line_added: product.sku,
      quantity: parsed.data.quantity,
    },
  });
}

/**
 * Choose or change where a draft order will be delivered. Separate from
 * creation because a company can raise an order before it has set up any
 * warehouse — and separate from issuing because the choice must be made
 * before the commitment, not during it.
 */
export async function setOrderWarehouse(input: unknown): Promise<void> {
  const parsed = setOrderWarehouseSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const order = await loadOrderOr404(parsed.data.orderId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingOrderManage,
    companyId: order.company_id,
  });
  const session = await requireActiveUser();
  if (order.status !== "draft") {
    throw conflict("The destination can only be changed while the order is a draft");
  }

  const warehouse = await resolveDestination(order.company_id, parsed.data.warehouseId);
  if (warehouse.id === order.warehouse_id) return;

  const admin = createAdminSupabase();
  const { data: updated, error } = await admin
    .from("purchase_orders")
    .update({ warehouse_id: warehouse.id, updated_by: ctx.userId })
    .eq("id", order.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) throw internal();
  if (!updated) throw conflict("The order is no longer a draft");

  // Where goods land is a stock fact, so the change is on the record even
  // though the order has not been issued yet.
  let previousCode: string | null = null;
  if (order.warehouse_id) {
    const { data: previous } = await admin
      .from("warehouses")
      .select("code")
      .eq("id", order.warehouse_id)
      .maybeSingle();
    previousCode = previous?.code ?? null;
  }
  await writeAudit({
    module: "purchasing",
    action: "purchase_order.destination_set",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: order.company_id,
    entityType: "purchase_order",
    entityId: order.id,
    previousValue: { warehouse: previousCode },
    newValue: { number: order.number, warehouse: warehouse.code },
  });
}

/** Issue: the order becomes a commitment and stops being editable. */
export async function issueOrder(input: unknown): Promise<void> {
  const parsed = orderIdSchema.safeParse(input);
  if (!parsed.success) throw invalidInput("Invalid identifier");
  const order = await loadOrderOr404(parsed.data.orderId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingOrderManage,
    companyId: order.company_id,
  });
  await requirePermission({
    permission: PERMISSIONS.purchasingCostView,
    companyId: order.company_id,
  });
  const session = await requireActiveUser();

  const admin = createAdminSupabase();
  const { count, error: countError } = await admin
    .from("purchase_order_lines")
    .select("id", { count: "exact", head: true })
    .eq("order_id", order.id);
  if (countError) throw internal();

  // The destination is re-read here rather than trusted from drafting
  // time: a warehouse can be archived between the two.
  let warehouseStatus: string | null = null;
  if (order.warehouse_id) {
    const { data: warehouse, error: warehouseError } = await admin
      .from("warehouses")
      .select("status")
      .eq("id", order.warehouse_id)
      .maybeSingle();
    if (warehouseError) throw internal();
    warehouseStatus = warehouse?.status ?? null;
  }

  const block = issueBlockReason({
    status: order.status,
    lineCount: count ?? 0,
    warehouseId: order.warehouse_id,
    warehouseStatus,
  });
  if (block) throw conflict(ISSUE_BLOCK_MESSAGE[block]);

  const { data: updated, error } = await admin
    .from("purchase_orders")
    .update({
      status: "issued",
      issued_at: new Date().toISOString(),
      issued_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .eq("id", order.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) throw internal();
  if (!updated) throw conflict("The order was already issued");

  // An order raised from a request closes that request out.
  if (order.request_id) {
    await admin
      .from("purchase_requests")
      .update({ status: "ordered", updated_by: ctx.userId })
      .eq("id", order.request_id)
      .eq("status", "approved");
  }

  await writeAudit({
    module: "purchasing",
    action: "purchase_order.issued",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: order.company_id,
    entityType: "purchase_order",
    entityId: order.id,
    previousValue: { status: "draft" },
    newValue: { number: order.number, status: "issued", currency: order.currency },
  });
}

export async function cancelOrder(input: unknown): Promise<void> {
  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const order = await loadOrderOr404(parsed.data.orderId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingOrderManage,
    companyId: order.company_id,
  });
  const session = await requireActiveUser();
  if (!["draft", "issued"].includes(order.status)) {
    throw conflict("Only draft or issued orders can be cancelled");
  }

  const admin = createAdminSupabase();
  const { data: updated, error } = await admin
    .from("purchase_orders")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: parsed.data.reason,
      updated_by: ctx.userId,
    })
    .eq("id", order.id)
    .in("status", ["draft", "issued"])
    .select("id")
    .maybeSingle();
  if (error) throw internal();
  if (!updated) throw conflict("The order is no longer cancellable");

  await writeAudit({
    module: "purchasing",
    action: "purchase_order.cancelled",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: order.company_id,
    entityType: "purchase_order",
    entityId: order.id,
    previousValue: { status: order.status },
    newValue: { number: order.number, status: "cancelled" },
    reason: parsed.data.reason,
  });
}

/**
 * Record a delivery. The database function writes the receipt header,
 * every line, and the resulting order status in one transaction, so a
 * failure part-way leaves no trace of a half-recorded delivery.
 */
export async function recordReceipt(input: unknown): Promise<string> {
  const parsed = recordReceiptSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const order = await loadOrderOr404(parsed.data.orderId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingReceive,
    companyId: order.company_id,
  });
  await requirePermission({
    permission: PERMISSIONS.purchasingOrderView,
    companyId: order.company_id,
  });
  const session = await requireActiveUser();

  if (!["issued", "partially_received"].includes(order.status)) {
    throw conflict("Only issued orders can be received");
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("record_purchase_receipt", {
    p_company_id: order.company_id,
    p_order_id: order.id,
    p_lines: parsed.data.lines.map((l) => ({
      order_line_id: l.orderLineId,
      accepted_qty: l.acceptedQty,
      damaged_qty: l.damagedQty,
      missing_qty: l.missingQty,
      extra_qty: l.extraQty,
      note: l.note ?? null,
    })),
    p_note: parsed.data.note ?? "",
    p_actor: ctx.userId,
  });
  if (error) {
    // The transaction rolled back; surface the reason without leaking
    // database internals.
    if (error.message.includes("does not belong")) {
      throw invalidInput("A receipt line does not belong to this order");
    }
    if (error.message.includes("Only issued orders")) {
      throw conflict("Only issued orders can be received");
    }
    throw internal("The receipt could not be recorded");
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.receipt_id) throw internal("The receipt could not be recorded");

  await writeAudit({
    module: "purchasing",
    action: "purchase_receipt.recorded",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: order.company_id,
    entityType: "purchase_order",
    entityId: order.id,
    newValue: {
      receipt: result.receipt_number,
      order: order.number,
      line_count: parsed.data.lines.length,
      order_status: result.order_status,
    },
  });

  // Discrepancies get their own event: a receiving dispute needs the
  // quantities, and they must be findable without reading every receipt.
  const discrepancies = parsed.data.lines.filter(
    (l) => l.damagedQty > 0 || l.missingQty > 0 || l.extraQty > 0,
  );
  if (discrepancies.length > 0) {
    await writeAudit({
      module: "purchasing",
      action: "purchase_receipt.discrepancy",
      actorUserId: ctx.userId,
      actorEmail: session.email,
      companyId: order.company_id,
      entityType: "purchase_order",
      entityId: order.id,
      newValue: {
        receipt: result.receipt_number,
        order: order.number,
        lines: discrepancies.map((l) => ({
          damaged: l.damagedQty,
          missing: l.missingQty,
          extra: l.extraQty,
        })),
      },
    });
  }

  return result.receipt_id;
}
