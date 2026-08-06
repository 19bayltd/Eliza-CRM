import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireActiveUser } from "@/server/auth/session";
import { PERMISSIONS, requirePermission } from "@/server/permissions";
import { writeAudit } from "@/server/audit";
import { conflict, internal, invalidInput, notFound } from "@/server/errors";
import {
  cancelCountSchema,
  countIdSchema,
  countVariance,
  enterCountLineSchema,
  openCountSchema,
} from "@/server/validation/inventory";
import type { Tables } from "@/types/database";

/**
 * Physical stock counts. Opening a count snapshots what the system
 * believes, staff record what they see, and posting writes one
 * `count_correction` per differing line — nothing at all where the count
 * matched, so an accurate warehouse produces an empty correction set.
 */

export type CountLine = Tables<"stock_count_lines"> & {
  productSku: string;
  variantSku: string | null;
  variance: number | null;
};

export type CountDetail = {
  count: Tables<"stock_counts"> & { warehouseCode: string };
  lines: CountLine[];
};

async function loadCountOr404(countId: string) {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("stock_counts")
    .select("*")
    .eq("id", countId)
    .maybeSingle();
  if (!data) throw notFound("Stock count not found");
  return data;
}

export async function listCounts(
  companyId: string,
): Promise<(Tables<"stock_counts"> & { warehouseCode: string; lineCount: number })[]> {
  await requirePermission({ permission: PERMISSIONS.inventoryView, companyId });
  const supabase = await createServerSupabase();
  const [counts, lines] = await Promise.all([
    supabase
      .from("stock_counts")
      .select("*, warehouses!stock_counts_warehouse_id_fkey!inner(code)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase.from("stock_count_lines").select("id, count_id").eq("company_id", companyId),
  ]);
  if (counts.error || lines.error) throw internal();
  return (counts.data ?? []).map((row) => {
    const { warehouses, ...count } = row;
    return {
      ...count,
      warehouseCode: warehouses.code,
      lineCount: (lines.data ?? []).filter((l) => l.count_id === count.id).length,
    };
  });
}

export async function getCountDetail(countId: string): Promise<CountDetail> {
  const parsed = countIdSchema.safeParse({ countId });
  if (!parsed.success) throw invalidInput("Invalid identifier");
  const count = await loadCountOr404(parsed.data.countId);
  await requirePermission({
    permission: PERMISSIONS.inventoryView,
    companyId: count.company_id,
  });

  const admin = createAdminSupabase();
  const [warehouse, linesResult] = await Promise.all([
    admin.from("warehouses").select("code").eq("id", count.warehouse_id).single(),
    admin
      .from("stock_count_lines")
      .select(
        "*, products!stock_count_lines_product_id_fkey!inner(sku), product_variants!stock_count_lines_variant_id_fkey(sku)",
      )
      .eq("count_id", count.id)
      .order("created_at"),
  ]);
  if (warehouse.error || linesResult.error) throw internal();

  return {
    count: { ...count, warehouseCode: warehouse.data.code },
    lines: (linesResult.data ?? []).map((row) => {
      const { products, product_variants, ...line } = row;
      return {
        ...line,
        productSku: products.sku,
        variantSku: product_variants?.sku ?? null,
        variance: countVariance(line),
      };
    }),
  };
}

/**
 * Open a count over everything the warehouse currently holds. The system
 * quantity is snapshotted per line now; later movements do not rewrite
 * it, so the variance answers "what changed relative to what we believed
 * when we started counting".
 */
export async function openCount(input: unknown): Promise<string> {
  const parsed = openCountSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await requirePermission({
    permission: PERMISSIONS.inventoryCountManage,
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
    throw conflict("Archived warehouses cannot be counted");
  }

  const { data: open } = await admin
    .from("stock_counts")
    .select("id, number")
    .eq("warehouse_id", warehouse.id)
    .eq("status", "counting")
    .maybeSingle();
  if (open) {
    throw conflict(`Count ${open.number} is already open for this warehouse`);
  }

  const { data: balances, error: balError } = await admin
    .from("stock_balances")
    .select("product_id, variant_id, quantity")
    .eq("warehouse_id", warehouse.id);
  if (balError) throw internal();
  if (!balances || balances.length === 0) {
    throw conflict("This warehouse holds no stock to count");
  }

  const { data: number, error: numberError } = await admin.rpc("next_document_number", {
    p_company_id: parsed.data.companyId,
    p_doc_type: "CNT",
  });
  if (numberError || !number) throw internal("Could not allocate a count number");

  const { data: count, error } = await admin
    .from("stock_counts")
    .insert({
      company_id: parsed.data.companyId,
      number,
      warehouse_id: warehouse.id,
      note: parsed.data.note ?? null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id, number")
    .single();
  if (error || !count) throw internal("Count could not be opened");

  const { error: linesError } = await admin.from("stock_count_lines").insert(
    balances.map((b) => ({
      company_id: parsed.data.companyId,
      count_id: count.id,
      product_id: b.product_id,
      variant_id: b.variant_id,
      system_qty: b.quantity,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })),
  );
  if (linesError) {
    await admin.from("stock_counts").delete().eq("id", count.id);
    throw internal("Count lines could not be created");
  }

  await writeAudit({
    module: "inventory",
    action: "stock.count_opened",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId,
    entityType: "stock_count",
    entityId: count.id,
    newValue: { number: count.number, warehouse: warehouse.code, line_count: balances.length },
  });
  return count.id;
}

export async function enterCountLine(input: unknown): Promise<void> {
  const parsed = enterCountLineSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const count = await loadCountOr404(parsed.data.countId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.inventoryCountManage,
    companyId: count.company_id,
  });
  if (count.status !== "counting") {
    throw conflict("Only an open count can be edited");
  }

  const admin = createAdminSupabase();
  const { data: updated, error } = await admin
    .from("stock_count_lines")
    .update({
      counted_qty: parsed.data.countedQty,
      note: parsed.data.note ?? null,
      updated_by: ctx.userId,
    })
    .eq("id", parsed.data.lineId)
    .eq("count_id", count.id)
    .select("id")
    .maybeSingle();
  if (error) throw internal();
  if (!updated) throw invalidInput("That line does not belong to this count");
}

/** Post the variances. Lines that matched write nothing. */
export async function postCount(input: unknown): Promise<void> {
  const parsed = countIdSchema.safeParse(input);
  if (!parsed.success) throw invalidInput("Invalid identifier");
  const count = await loadCountOr404(parsed.data.countId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.inventoryCountManage,
    companyId: count.company_id,
  });
  const session = await requireActiveUser();
  if (count.status !== "counting") {
    throw conflict("Only an open count can be posted");
  }

  const admin = createAdminSupabase();
  const { data: lines, error: linesError } = await admin
    .from("stock_count_lines")
    .select("*")
    .eq("count_id", count.id);
  if (linesError) throw internal();
  if (!(lines ?? []).some((l) => l.counted_qty !== null)) {
    throw conflict("Enter at least one counted quantity before posting");
  }

  const entries = (lines ?? [])
    .map((l) => ({ line: l, variance: countVariance(l) }))
    .filter((x): x is { line: (typeof lines)[number]; variance: number } => x.variance !== null)
    .map(({ line, variance }) => ({
      warehouse_id: count.warehouse_id,
      product_id: line.product_id,
      variant_id: line.variant_id,
      txn_type: "count_correction",
      quantity: variance,
      reference_type: "stock_count",
      reference_id: count.id,
      reference_number: count.number,
      reason: `Counted on ${count.number}`,
    }));

  const { data: claimed, error: claimError } = await admin
    .from("stock_counts")
    .update({
      status: "posted",
      posted_at: new Date().toISOString(),
      posted_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .eq("id", count.id)
    .eq("status", "counting")
    .select("id")
    .maybeSingle();
  if (claimError) throw internal();
  if (!claimed) throw conflict("The count was already posted");

  if (entries.length > 0) {
    const { error } = await admin.rpc("post_stock_entries", {
      p_company_id: count.company_id,
      p_entries: entries,
      p_actor: ctx.userId,
      // A count reports reality; if reality is negative, the count is
      // wrong, so this never overrides the block.
      p_allow_negative: false,
    });
    if (error) {
      await admin
        .from("stock_counts")
        .update({ status: "counting", posted_at: null, posted_by: null })
        .eq("id", count.id);
      if ((error.message ?? "").includes("Insufficient stock")) {
        throw conflict(error.message.replace(/^.*?Insufficient/, "Insufficient"));
      }
      throw internal("The count could not be posted");
    }
  }

  await writeAudit({
    module: "inventory",
    action: "stock.count_posted",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: count.company_id,
    entityType: "stock_count",
    entityId: count.id,
    previousValue: { status: "counting" },
    newValue: {
      number: count.number,
      lines_with_variance: entries.length,
      entries_posted: entries.length,
    },
  });
}

export async function cancelCount(input: unknown): Promise<void> {
  const parsed = cancelCountSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const count = await loadCountOr404(parsed.data.countId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.inventoryCountManage,
    companyId: count.company_id,
  });
  const session = await requireActiveUser();
  if (count.status !== "counting") {
    throw conflict("Only an open count can be cancelled");
  }

  const admin = createAdminSupabase();
  const { data: updated, error } = await admin
    .from("stock_counts")
    .update({
      status: "cancelled",
      cancel_reason: parsed.data.reason,
      updated_by: ctx.userId,
    })
    .eq("id", count.id)
    .eq("status", "counting")
    .select("id")
    .maybeSingle();
  if (error) throw internal();
  if (!updated) throw conflict("The count is no longer cancellable");

  await writeAudit({
    module: "inventory",
    action: "stock.count_cancelled",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: count.company_id,
    entityType: "stock_count",
    entityId: count.id,
    previousValue: { status: "counting" },
    newValue: { number: count.number, status: "cancelled" },
    reason: parsed.data.reason,
  });
}
