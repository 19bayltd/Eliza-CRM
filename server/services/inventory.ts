import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireActiveUser } from "@/server/auth/session";
import { PERMISSIONS, requirePermission } from "@/server/permissions";
import { writeAudit } from "@/server/audit";
import { conflict, internal, invalidInput, notFound } from "@/server/errors";
import {
  createLocationSchema,
  postMovementSchema,
  signMatchesType,
  type TxnType,
} from "@/server/validation/inventory";
import type { Tables } from "@/types/database";

/**
 * Stock balances, ledger history, manual movements and warehouse
 * locations.
 *
 * Every posting goes through `post_stock_entries`, which writes ledger
 * rows inside one transaction; the balance trigger applies them and
 * refuses to let any balance go negative. Nothing here writes
 * `stock_balances` — nothing anywhere does.
 */

export type BalanceRow = Tables<"stock_balances"> & {
  warehouseCode: string;
  productSku: string;
  productName: string;
  variantSku: string | null;
};

export type LedgerRow = Tables<"stock_ledger"> & {
  warehouseCode: string;
  productSku: string;
};

/** Translate the database's negative-stock refusal into a typed error. */
function mapPostingError(error: { message?: string } | null): never {
  const message = error?.message ?? "";
  if (message.includes("Insufficient stock")) {
    // The trigger's message already names the product and the balance it
    // would have reached; it contains no confidential data.
    throw conflict(message.replace(/^.*?Insufficient/, "Insufficient"));
  }
  if (message.includes("append-only")) {
    throw conflict("Stock history cannot be changed; post a correcting entry instead");
  }
  throw internal("The stock movement could not be posted");
}

export async function listBalances(companyId: string): Promise<BalanceRow[]> {
  await requirePermission({ permission: PERMISSIONS.inventoryView, companyId });
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("stock_balances")
    .select(
      "*, warehouses!stock_balances_warehouse_id_fkey!inner(code), products!stock_balances_product_id_fkey!inner(sku, name), product_variants!stock_balances_variant_id_fkey(sku)",
    )
    .eq("company_id", companyId)
    .order("quantity", { ascending: false });
  if (error) throw internal();
  return (data ?? []).map((row) => {
    const { warehouses, products, product_variants, ...balance } = row;
    return {
      ...balance,
      warehouseCode: warehouses.code,
      productSku: products.sku,
      productName: products.name,
      variantSku: product_variants?.sku ?? null,
    };
  });
}

/** Recent ledger history — the answer to "why is the balance this?". */
export async function listLedger(
  companyId: string,
  limit = 100,
): Promise<LedgerRow[]> {
  await requirePermission({ permission: PERMISSIONS.inventoryView, companyId });
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("stock_ledger")
    .select(
      "*, warehouses!stock_ledger_warehouse_id_fkey!inner(code), products!stock_ledger_product_id_fkey!inner(sku)",
    )
    .eq("company_id", companyId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw internal();
  return (data ?? []).map((row) => {
    const { warehouses, products, ...entry } = row;
    return { ...entry, warehouseCode: warehouses.code, productSku: products.sku };
  });
}

export async function listWarehouses(
  companyId: string,
): Promise<Tables<"warehouses">[]> {
  await requirePermission({ permission: PERMISSIONS.inventoryView, companyId });
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("code");
  if (error) throw internal();
  return data ?? [];
}

export async function listLocations(
  companyId: string,
): Promise<(Tables<"warehouse_locations"> & { warehouseCode: string })[]> {
  await requirePermission({ permission: PERMISSIONS.inventoryView, companyId });
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("warehouse_locations")
    .select("*, warehouses!warehouse_locations_warehouse_id_fkey!inner(code)")
    .eq("company_id", companyId)
    .order("code");
  if (error) throw internal();
  return (data ?? []).map((row) => {
    const { warehouses, ...location } = row;
    return { ...location, warehouseCode: warehouses.code };
  });
}

export async function createLocation(input: unknown): Promise<void> {
  const parsed = createLocationSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const admin = createAdminSupabase();
  const { data: warehouse } = await admin
    .from("warehouses")
    .select("id, company_id, code")
    .eq("id", parsed.data.warehouseId)
    .maybeSingle();
  if (!warehouse) throw notFound("Warehouse not found");

  const ctx = await requirePermission({
    permission: PERMISSIONS.inventoryLocationManage,
    companyId: warehouse.company_id,
  });
  const session = await requireActiveUser();

  const { error } = await admin.from("warehouse_locations").insert({
    company_id: warehouse.company_id,
    warehouse_id: warehouse.id,
    code: parsed.data.code,
    name: parsed.data.name,
    created_by: ctx.userId,
    updated_by: ctx.userId,
  });
  if (error) {
    if (error.code === "23505") throw conflict("That location code already exists");
    throw internal("Location could not be created");
  }

  await writeAudit({
    module: "inventory",
    action: "stock.location_created",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: warehouse.company_id,
    entityType: "warehouse_location",
    entityId: warehouse.id,
    newValue: { warehouse: warehouse.code, code: parsed.data.code },
  });
}

/**
 * Post a manual movement: opening stock, damage, or a supplier return.
 * The form supplies a magnitude; the transaction type decides the sign,
 * so a user cannot accidentally record damage as an increase.
 */
export async function postMovement(input: unknown): Promise<void> {
  const parsed = postMovementSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await requirePermission({
    permission: PERMISSIONS.inventoryMovementPost,
    companyId: parsed.data.companyId,
  });
  const session = await requireActiveUser();

  const type = parsed.data.txnType as TxnType;
  const signed =
    type === "opening_stock" ? parsed.data.quantity : -parsed.data.quantity;
  if (!signMatchesType(type, signed)) {
    throw invalidInput("That quantity is not valid for this movement type");
  }

  // Going below zero is a separate, separately-permissioned act.
  if (parsed.data.allowNegative) {
    await requirePermission({
      permission: PERMISSIONS.inventoryNegativeOverride,
      companyId: parsed.data.companyId,
    });
  }

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
    throw conflict("Archived warehouses cannot receive stock movements");
  }

  const { data: product } = await admin
    .from("products")
    .select("id, company_id, sku, status")
    .eq("id", parsed.data.productId)
    .maybeSingle();
  if (!product || product.company_id !== parsed.data.companyId) {
    throw invalidInput("Product does not belong to this company");
  }
  if (product.status === "archived") {
    throw conflict("Archived products cannot receive stock movements");
  }

  if (parsed.data.variantId) {
    const { data: variant } = await admin
      .from("product_variants")
      .select("id, product_id, company_id")
      .eq("id", parsed.data.variantId)
      .maybeSingle();
    if (!variant || variant.company_id !== parsed.data.companyId) {
      throw invalidInput("Variant does not belong to this company");
    }
    if (variant.product_id !== product.id) {
      throw invalidInput("Variant does not belong to the selected product");
    }
  }

  const { error } = await admin.rpc("post_stock_entries", {
    p_company_id: parsed.data.companyId,
    p_entries: [
      {
        warehouse_id: warehouse.id,
        product_id: product.id,
        variant_id: parsed.data.variantId ?? null,
        txn_type: type,
        quantity: signed,
        reference_type: "manual",
        reason: parsed.data.reason,
      },
    ],
    p_actor: ctx.userId,
    p_allow_negative: parsed.data.allowNegative,
  });
  if (error) mapPostingError(error);

  await writeAudit({
    module: "inventory",
    action: "stock.movement_posted",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId,
    entityType: "stock_ledger",
    entityId: warehouse.id,
    newValue: {
      type,
      warehouse: warehouse.code,
      sku: product.sku,
      quantity: signed,
    },
    reason: parsed.data.reason,
  });

  // An override is a deviation from the rule, recorded as such even
  // though the movement itself succeeded.
  if (parsed.data.allowNegative) {
    await writeAudit({
      module: "inventory",
      action: "stock.negative_override_used",
      actorUserId: ctx.userId,
      actorEmail: session.email,
      companyId: parsed.data.companyId,
      entityType: "stock_ledger",
      entityId: warehouse.id,
      newValue: { type, warehouse: warehouse.code, sku: product.sku, quantity: signed },
      reason: parsed.data.reason,
      result: "failure",
    });
  }
}
