import "server-only";

import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/server/auth/session";
import { PERMISSIONS, hasPermission, requirePermission } from "@/server/permissions";
import { writeAudit } from "@/server/audit";
import { conflict, internal, invalidInput, notFound } from "@/server/errors";
import {
  archiveSupplierEntitySchema,
  createQuotationSchema,
  multiplyDecimalStrings,
} from "@/server/validation/suppliers";
import { uuidSchema } from "@/server/validation/organization";
import type { Tables } from "@/types/database";

/**
 * Supplier quotations. Metadata (terms, MOQ, lead time) is visible with
 * suppliers.quotation.view; prices live in supplier_quotation_costs and
 * require suppliers.quotation.cost.view — every price read is audited.
 * Creating a quotation includes a price, so it requires quotation.manage
 * AND cost.view together.
 */

export type QuotationEntry = Tables<"supplier_quotations"> & {
  supplierCode: string;
  supplierName: string;
  productSku: string;
  variantSku: string | null;
  /** Present only when the caller holds the cost permission. */
  cost: {
    unitPrice: string;
    currency: string;
    exchangeRate: string;
    normalized: string;
    baseCurrency: string;
  } | null;
};

async function loadQuotations(params: {
  companyId: string;
  supplierId?: string;
  productId?: string;
}): Promise<QuotationEntry[]> {
  await requirePermission({
    permission: PERMISSIONS.suppliersQuotationView,
    companyId: params.companyId,
  });
  const canSeeCosts = await hasPermission({
    permission: PERMISSIONS.suppliersQuotationCostView,
    companyId: params.companyId,
  });
  const admin = createAdminSupabase();

  let query = admin
    .from("supplier_quotations")
    .select(
      "*, suppliers!inner(code, name), products!inner(sku), product_variants(sku), companies!inner(base_currency)",
    )
    .eq("company_id", params.companyId)
    .order("created_at", { ascending: false });
  if (params.supplierId) query = query.eq("supplier_id", params.supplierId);
  if (params.productId) query = query.eq("product_id", params.productId);
  const { data: rows, error } = await query;
  if (error) throw internal();

  let costsById = new Map<
    string,
    { unit_price: number; currency: string; exchange_rate: number }
  >();
  if (canSeeCosts && (rows ?? []).length > 0) {
    const { data: costs, error: costError } = await admin
      .from("supplier_quotation_costs")
      .select("quotation_id, unit_price, currency, exchange_rate")
      .in(
        "quotation_id",
        (rows ?? []).map((r) => r.id),
      );
    if (costError) throw internal();
    costsById = new Map((costs ?? []).map((c) => [c.quotation_id, c]));
  }

  return (rows ?? []).map((row) => {
    const { suppliers, products, product_variants, companies, ...quotation } = row;
    const cost = costsById.get(row.id);
    return {
      ...quotation,
      supplierCode: suppliers.code,
      supplierName: suppliers.name,
      productSku: products.sku,
      variantSku: product_variants?.sku ?? null,
      cost: cost
        ? {
            unitPrice: String(cost.unit_price),
            currency: cost.currency,
            exchangeRate: String(cost.exchange_rate),
            // Exact decimal math — float rounding misranked suppliers on
            // the comparison surface (review finding: 2.675 → "2.67").
            normalized: multiplyDecimalStrings(
              String(cost.unit_price),
              String(cost.exchange_rate),
            ),
            baseCurrency: companies.base_currency,
          }
        : null,
    };
  });
}

/** Quotations for one supplier (prices only with the cost permission). */
export async function listSupplierQuotations(
  supplierId: string,
): Promise<QuotationEntry[]> {
  if (!uuidSchema.safeParse(supplierId).success) throw invalidInput("Invalid identifier");
  const admin = createAdminSupabase();
  const { data: supplier } = await admin
    .from("suppliers")
    .select("id, company_id")
    .eq("id", supplierId)
    .maybeSingle();
  if (!supplier) throw notFound("Supplier not found");
  const entries = await loadQuotations({
    companyId: supplier.company_id,
    supplierId: supplier.id,
  });
  await auditCostViews(entries, "supplier", supplier.id);
  return entries;
}

/** Side-by-side comparison of all quotations for one product. */
export async function compareQuotations(productId: string): Promise<{
  productSku: string;
  entries: QuotationEntry[];
}> {
  if (!uuidSchema.safeParse(productId).success) throw invalidInput("Invalid identifier");
  const admin = createAdminSupabase();
  const { data: product } = await admin
    .from("products")
    .select("id, company_id, sku")
    .eq("id", productId)
    .maybeSingle();
  if (!product) throw notFound("Product not found");
  const entries = await loadQuotations({
    companyId: product.company_id,
    productId: product.id,
  });
  await auditCostViews(entries, "product", product.id);
  return { productSku: product.sku, entries };
}

/** One audited cost-view event per page render that exposed prices. */
async function auditCostViews(
  entries: QuotationEntry[],
  entityType: string,
  entityId: string,
): Promise<void> {
  if (!entries.some((e) => e.cost !== null)) return;
  const session = await requireActiveUser();
  await writeAudit(
    {
      module: "suppliers",
      action: "quotation.cost_viewed",
      actorUserId: session.userId,
      actorEmail: session.email,
      companyId: entries[0]?.company_id ?? null,
      entityType,
      entityId,
      newValue: { quotations_with_prices: entries.filter((e) => e.cost).length },
    },
    { critical: false },
  );
}

export async function createQuotation(
  input: z.input<typeof createQuotationSchema>,
): Promise<void> {
  const parsed = createQuotationSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const admin = createAdminSupabase();

  const { data: supplier } = await admin
    .from("suppliers")
    .select("id, company_id, code, status")
    .eq("id", parsed.data.supplierId)
    .maybeSingle();
  if (!supplier) throw notFound("Supplier not found");

  // Authorize FIRST (prices are part of a quotation: both permissions),
  // so status/relationship responses below reach authorized users only —
  // review finding: the previous order was a metadata oracle.
  await requirePermission({
    permission: PERMISSIONS.suppliersQuotationManage,
    companyId: supplier.company_id,
  });
  const ctx = await requirePermission({
    permission: PERMISSIONS.suppliersQuotationCostView,
    companyId: supplier.company_id,
  });
  const session = await requireActiveUser();

  if (supplier.status === "archived") {
    throw conflict("Archived suppliers cannot receive new quotations");
  }

  const { data: product } = await admin
    .from("products")
    .select("id, company_id, sku, status")
    .eq("id", parsed.data.productId)
    .maybeSingle();
  if (!product || product.company_id !== supplier.company_id) {
    throw invalidInput("Product does not belong to the supplier's company");
  }
  if (product.status === "archived") {
    throw conflict("Archived products cannot receive quotations");
  }
  if (parsed.data.variantId) {
    const { data: variant } = await admin
      .from("product_variants")
      .select("id, product_id")
      .eq("id", parsed.data.variantId)
      .maybeSingle();
    if (!variant || variant.product_id !== product.id) {
      throw invalidInput("Variant does not belong to the selected product");
    }
  }

  const { data: quotation, error } = await admin
    .from("supplier_quotations")
    .insert({
      company_id: supplier.company_id,
      supplier_id: supplier.id,
      product_id: product.id,
      variant_id: parsed.data.variantId ?? null,
      moq: parsed.data.moq ?? null,
      lead_time_days: parsed.data.leadTimeDays ?? null,
      valid_until: parsed.data.validUntil ?? null,
      terms: parsed.data.terms ?? null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select()
    .single();
  if (error) throw internal();

  const { error: costError } = await admin.from("supplier_quotation_costs").insert({
    quotation_id: quotation.id,
    company_id: supplier.company_id,
    // Validated decimal strings — never floats.
    unit_price: parsed.data.unitPrice as unknown as number,
    currency: parsed.data.currency,
    exchange_rate: parsed.data.exchangeRate as unknown as number,
    created_by: ctx.userId,
    updated_by: ctx.userId,
  });
  if (costError) {
    // Keep quotation and cost consistent; a failed compensation must not
    // pass silently (review finding: orphan price-less quotations).
    const { error: cleanupError } = await admin
      .from("supplier_quotations")
      .delete()
      .eq("id", quotation.id);
    if (cleanupError) {
      console.error(`quotation orphan cleanup failed: ${quotation.id}`);
      await writeAudit(
        {
          module: "suppliers",
          action: "quotation.orphan_cleanup_failed",
          actorUserId: ctx.userId,
          actorEmail: session.email,
          companyId: supplier.company_id,
          entityType: "quotation",
          entityId: quotation.id,
          failureReason: "cost_insert_and_cleanup_failed",
          result: "failure",
        },
        { critical: false },
      );
    }
    throw internal("Quotation price could not be recorded");
  }

  // Close the archive race: if the supplier was archived between our
  // status check and the insert, undo and refuse (review finding).
  const { data: supplierNow } = await admin
    .from("suppliers")
    .select("status")
    .eq("id", supplier.id)
    .maybeSingle();
  if (supplierNow?.status !== "active") {
    await admin.from("supplier_quotation_costs").delete().eq("quotation_id", quotation.id);
    await admin.from("supplier_quotations").delete().eq("id", quotation.id);
    throw conflict("Supplier was archived while the quotation was being created");
  }

  // Confidential price values never enter the audit payload.
  await writeAudit({
    module: "suppliers",
    action: "quotation.created",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: supplier.company_id,
    entityType: "quotation",
    entityId: quotation.id,
    newValue: {
      supplier: supplier.code,
      product_sku: product.sku,
      currency: parsed.data.currency,
      moq: parsed.data.moq ?? null,
      lead_time_days: parsed.data.leadTimeDays ?? null,
      valid_until: parsed.data.validUntil ?? null,
    },
  });
}

export async function archiveQuotation(
  input: z.input<typeof archiveSupplierEntitySchema>,
): Promise<void> {
  const parsed = archiveSupplierEntitySchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const admin = createAdminSupabase();
  const { data: before } = await admin
    .from("supplier_quotations")
    .select("*, suppliers!inner(code)")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!before) throw notFound("Quotation not found");
  if (before.status === "archived") throw conflict("Quotation is already archived");

  const ctx = await requirePermission({
    permission: PERMISSIONS.suppliersQuotationManage,
    companyId: before.company_id,
  });
  const session = await requireActiveUser();

  const { error } = await admin
    .from("supplier_quotations")
    .update({ status: "archived", updated_by: ctx.userId })
    .eq("id", before.id);
  if (error) throw internal();

  await writeAudit({
    module: "suppliers",
    action: "quotation.archived",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: before.company_id,
    entityType: "quotation",
    entityId: before.id,
    previousValue: { supplier: before.suppliers.code, status: before.status },
    newValue: { status: "archived" },
    reason: parsed.data.reason,
  });
}
