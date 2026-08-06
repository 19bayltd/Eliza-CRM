import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireActiveUser } from "@/server/auth/session";
import { PERMISSIONS, requirePermission } from "@/server/permissions";
import { writeAudit } from "@/server/audit";
import { conflict, internal, invalidInput, notFound } from "@/server/errors";
import {
  addTransferLineSchema,
  cancelTransferSchema,
  createTransferSchema,
  receiveTransferSchema,
  transferIdSchema,
} from "@/server/validation/inventory";
import type { Tables } from "@/types/database";

/**
 * Warehouse transfers in two steps. Dispatch removes stock from the
 * source; receipt adds it at the destination. Between the two the goods
 * are in transit — in neither warehouse's balance — which is the honest
 * representation of a truck on the road.
 */

export type TransferLine = Tables<"stock_transfer_lines"> & {
  productSku: string;
  variantSku: string | null;
};

export type TransferDetail = {
  transfer: Tables<"stock_transfers"> & { fromCode: string; toCode: string };
  lines: TransferLine[];
};

async function loadTransferOr404(transferId: string) {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("stock_transfers")
    .select("*")
    .eq("id", transferId)
    .maybeSingle();
  if (!data) throw notFound("Transfer not found");
  return data;
}

export async function listTransfers(
  companyId: string,
): Promise<(Tables<"stock_transfers"> & { fromCode: string; toCode: string; lineCount: number })[]> {
  await requirePermission({ permission: PERMISSIONS.inventoryView, companyId });
  const supabase = await createServerSupabase();
  const [transfers, lines] = await Promise.all([
    supabase
      .from("stock_transfers")
      .select(
        "*, from:warehouses!stock_transfers_from_warehouse_fkey!inner(code), to:warehouses!stock_transfers_to_warehouse_fkey!inner(code)",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase.from("stock_transfer_lines").select("id, transfer_id").eq("company_id", companyId),
  ]);
  if (transfers.error || lines.error) throw internal();
  return (transfers.data ?? []).map((row) => {
    const { from, to, ...transfer } = row;
    return {
      ...transfer,
      fromCode: from.code,
      toCode: to.code,
      lineCount: (lines.data ?? []).filter((l) => l.transfer_id === transfer.id).length,
    };
  });
}

export async function getTransferDetail(transferId: string): Promise<TransferDetail> {
  const parsed = transferIdSchema.safeParse({ transferId });
  if (!parsed.success) throw invalidInput("Invalid identifier");
  const transfer = await loadTransferOr404(parsed.data.transferId);
  await requirePermission({
    permission: PERMISSIONS.inventoryView,
    companyId: transfer.company_id,
  });

  const admin = createAdminSupabase();
  const [warehouses, linesResult] = await Promise.all([
    admin
      .from("warehouses")
      .select("id, code")
      .in("id", [transfer.from_warehouse, transfer.to_warehouse]),
    admin
      .from("stock_transfer_lines")
      .select(
        "*, products!stock_transfer_lines_product_id_fkey!inner(sku), product_variants!stock_transfer_lines_variant_id_fkey(sku)",
      )
      .eq("transfer_id", transfer.id)
      .order("created_at"),
  ]);
  if (warehouses.error || linesResult.error) throw internal();
  const codeById = new Map((warehouses.data ?? []).map((w) => [w.id, w.code]));

  return {
    transfer: {
      ...transfer,
      fromCode: codeById.get(transfer.from_warehouse) ?? "?",
      toCode: codeById.get(transfer.to_warehouse) ?? "?",
    },
    lines: (linesResult.data ?? []).map((row) => {
      const { products, product_variants, ...line } = row;
      return {
        ...line,
        productSku: products.sku,
        variantSku: product_variants?.sku ?? null,
      };
    }),
  };
}

export async function createTransfer(input: unknown): Promise<string> {
  const parsed = createTransferSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await requirePermission({
    permission: PERMISSIONS.inventoryTransferManage,
    companyId: parsed.data.companyId,
  });
  const session = await requireActiveUser();
  const admin = createAdminSupabase();

  const { data: warehouses, error: whError } = await admin
    .from("warehouses")
    .select("id, company_id, code, status")
    .in("id", [parsed.data.fromWarehouse, parsed.data.toWarehouse]);
  if (whError) throw internal();
  if ((warehouses ?? []).length !== 2) {
    throw invalidInput("Both warehouses must exist");
  }
  for (const w of warehouses ?? []) {
    if (w.company_id !== parsed.data.companyId) {
      throw invalidInput("Warehouses must belong to this company");
    }
    if (w.status !== "active") {
      throw conflict("Archived warehouses cannot take part in transfers");
    }
  }

  const { data: number, error: numberError } = await admin.rpc("next_document_number", {
    p_company_id: parsed.data.companyId,
    p_doc_type: "TRF",
  });
  if (numberError || !number) throw internal("Could not allocate a transfer number");

  const { data: transfer, error } = await admin
    .from("stock_transfers")
    .insert({
      company_id: parsed.data.companyId,
      number,
      from_warehouse: parsed.data.fromWarehouse,
      to_warehouse: parsed.data.toWarehouse,
      note: parsed.data.note ?? null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id, number")
    .single();
  if (error || !transfer) throw internal("Transfer could not be created");

  const fromCode = (warehouses ?? []).find((w) => w.id === parsed.data.fromWarehouse)?.code;
  const toCode = (warehouses ?? []).find((w) => w.id === parsed.data.toWarehouse)?.code;

  await writeAudit({
    module: "inventory",
    action: "stock.transfer_created",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId,
    entityType: "stock_transfer",
    entityId: transfer.id,
    newValue: { number: transfer.number, from: fromCode, to: toCode },
  });
  return transfer.id;
}

export async function addTransferLine(input: unknown): Promise<void> {
  const parsed = addTransferLineSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const transfer = await loadTransferOr404(parsed.data.transferId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.inventoryTransferManage,
    companyId: transfer.company_id,
  });
  if (transfer.status !== "draft") {
    throw conflict("Lines can only be added while the transfer is a draft");
  }

  const admin = createAdminSupabase();
  const { data: product } = await admin
    .from("products")
    .select("id, company_id, status")
    .eq("id", parsed.data.productId)
    .maybeSingle();
  if (!product || product.company_id !== transfer.company_id) {
    throw invalidInput("Product does not belong to this company");
  }
  if (product.status === "archived") {
    throw conflict("Archived products cannot be transferred");
  }
  if (parsed.data.variantId) {
    const { data: variant } = await admin
      .from("product_variants")
      .select("id, product_id, company_id")
      .eq("id", parsed.data.variantId)
      .maybeSingle();
    if (!variant || variant.company_id !== transfer.company_id) {
      throw invalidInput("Variant does not belong to this company");
    }
    if (variant.product_id !== product.id) {
      throw invalidInput("Variant does not belong to the selected product");
    }
  }

  const { error } = await admin.from("stock_transfer_lines").insert({
    company_id: transfer.company_id,
    transfer_id: transfer.id,
    product_id: product.id,
    variant_id: parsed.data.variantId ?? null,
    quantity: parsed.data.quantity,
    created_by: ctx.userId,
    updated_by: ctx.userId,
  });
  if (error) throw internal("Line could not be added");
}

/** Dispatch: stock leaves the source warehouse now. */
export async function dispatchTransfer(input: unknown): Promise<void> {
  const parsed = transferIdSchema.safeParse(input);
  if (!parsed.success) throw invalidInput("Invalid identifier");
  const transfer = await loadTransferOr404(parsed.data.transferId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.inventoryTransferManage,
    companyId: transfer.company_id,
  });
  const session = await requireActiveUser();
  if (transfer.status !== "draft") {
    throw conflict("Only draft transfers can be dispatched");
  }

  const admin = createAdminSupabase();
  const { data: lines, error: linesError } = await admin
    .from("stock_transfer_lines")
    .select("*")
    .eq("transfer_id", transfer.id);
  if (linesError) throw internal();
  if (!lines || lines.length === 0) {
    throw conflict("Add at least one line before dispatching");
  }

  // Status first, guarded: if two dispatches race, only one proceeds to
  // post stock, so the source cannot be debited twice.
  const { data: updated, error: statusError } = await admin
    .from("stock_transfers")
    .update({
      status: "dispatched",
      dispatched_at: new Date().toISOString(),
      dispatched_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .eq("id", transfer.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (statusError) throw internal();
  if (!updated) throw conflict("The transfer was already dispatched");

  const { error } = await admin.rpc("post_stock_entries", {
    p_company_id: transfer.company_id,
    p_entries: lines.map((l) => ({
      warehouse_id: transfer.from_warehouse,
      product_id: l.product_id,
      variant_id: l.variant_id,
      txn_type: "transfer_out",
      quantity: -l.quantity,
      reference_type: "stock_transfer",
      reference_id: transfer.id,
      reference_number: transfer.number,
      reason: `Dispatched on ${transfer.number}`,
    })),
    p_actor: ctx.userId,
    p_allow_negative: false,
  });
  if (error) {
    // Put the transfer back: it never left, so it must not say it did.
    await admin
      .from("stock_transfers")
      .update({ status: "draft", dispatched_at: null, dispatched_by: null })
      .eq("id", transfer.id);
    if ((error.message ?? "").includes("Insufficient stock")) {
      throw conflict(error.message.replace(/^.*?Insufficient/, "Insufficient"));
    }
    throw internal("The dispatch could not be posted");
  }

  await writeAudit({
    module: "inventory",
    action: "stock.transfer_dispatched",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: transfer.company_id,
    entityType: "stock_transfer",
    entityId: transfer.id,
    previousValue: { status: "draft" },
    newValue: { number: transfer.number, status: "dispatched", line_count: lines.length },
  });
}

/** Receive: stock arrives at the destination. */
export async function receiveTransfer(input: unknown): Promise<void> {
  const parsed = receiveTransferSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const transfer = await loadTransferOr404(parsed.data.transferId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.inventoryTransferReceive,
    companyId: transfer.company_id,
  });
  const session = await requireActiveUser();
  if (transfer.status !== "dispatched") {
    throw conflict("Only dispatched transfers can be received");
  }

  const admin = createAdminSupabase();
  const { data: lines, error: linesError } = await admin
    .from("stock_transfer_lines")
    .select("*")
    .eq("transfer_id", transfer.id);
  if (linesError) throw internal();

  const byId = new Map((lines ?? []).map((l) => [l.id, l]));
  const postings = [];
  for (const entry of parsed.data.lines) {
    const line = byId.get(entry.lineId);
    if (!line) throw invalidInput("A line does not belong to this transfer");
    if (entry.receivedQty > line.quantity) {
      throw invalidInput("Received quantity cannot exceed the quantity dispatched");
    }
    if (entry.receivedQty > 0) {
      postings.push({
        warehouse_id: transfer.to_warehouse,
        product_id: line.product_id,
        variant_id: line.variant_id,
        txn_type: "transfer_in",
        quantity: entry.receivedQty,
        reference_type: "stock_transfer",
        reference_id: transfer.id,
        reference_number: transfer.number,
        reason: `Received on ${transfer.number}`,
      });
    }
  }
  if (postings.length === 0) {
    throw invalidInput("Record at least one received quantity");
  }

  const { data: updated, error: statusError } = await admin
    .from("stock_transfers")
    .update({
      status: "received",
      received_at: new Date().toISOString(),
      received_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .eq("id", transfer.id)
    .eq("status", "dispatched")
    .select("id")
    .maybeSingle();
  if (statusError) throw internal();
  if (!updated) throw conflict("The transfer was already received");

  const { error } = await admin.rpc("post_stock_entries", {
    p_company_id: transfer.company_id,
    p_entries: postings,
    p_actor: ctx.userId,
    p_allow_negative: false,
  });
  if (error) {
    await admin
      .from("stock_transfers")
      .update({ status: "dispatched", received_at: null, received_by: null })
      .eq("id", transfer.id);
    throw internal("The receipt could not be posted");
  }

  for (const entry of parsed.data.lines) {
    await admin
      .from("stock_transfer_lines")
      .update({ received_qty: entry.receivedQty, updated_by: ctx.userId })
      .eq("id", entry.lineId);
  }

  await writeAudit({
    module: "inventory",
    action: "stock.transfer_received",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: transfer.company_id,
    entityType: "stock_transfer",
    entityId: transfer.id,
    previousValue: { status: "dispatched" },
    newValue: { number: transfer.number, status: "received", line_count: postings.length },
  });
}

export async function cancelTransfer(input: unknown): Promise<void> {
  const parsed = cancelTransferSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const transfer = await loadTransferOr404(parsed.data.transferId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.inventoryTransferManage,
    companyId: transfer.company_id,
  });
  const session = await requireActiveUser();
  // A dispatched transfer has already moved stock; cancelling it would
  // strand those units. It must be received (even at zero) instead.
  if (transfer.status !== "draft") {
    throw conflict(
      "Only draft transfers can be cancelled — a dispatched transfer must be received",
    );
  }

  const admin = createAdminSupabase();
  const { data: updated, error } = await admin
    .from("stock_transfers")
    .update({
      status: "cancelled",
      cancel_reason: parsed.data.reason,
      updated_by: ctx.userId,
    })
    .eq("id", transfer.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) throw internal();
  if (!updated) throw conflict("The transfer is no longer cancellable");

  await writeAudit({
    module: "inventory",
    action: "stock.transfer_cancelled",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: transfer.company_id,
    entityType: "stock_transfer",
    entityId: transfer.id,
    previousValue: { status: "draft" },
    newValue: { number: transfer.number, status: "cancelled" },
    reason: parsed.data.reason,
  });
}
