import "server-only";

import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireActiveUser } from "@/server/auth/session";
import { PERMISSIONS, requirePermission } from "@/server/permissions";
import { writeAudit } from "@/server/audit";
import { conflict, internal, invalidInput, notFound } from "@/server/errors";
import {
  PRODUCT_STATUS_TRANSITIONS,
  createProductSchema,
  createVariantSchema,
  setProductStatusSchema,
  setVariantStatusSchema,
  updateProductSchema,
  upsertIntelligenceSchema,
} from "@/server/validation/products";
import type { Tables } from "@/types/database";

/**
 * Product master service. Single source of truth for products and
 * variants: per-company SKU uniqueness, controlled status machine
 * (draft → active → archived → active), attribute-combination
 * uniqueness across a product's variants, and the confidential
 * intelligence record whose every read is audited.
 */

export type VariantWithAttributes = Tables<"product_variants"> & {
  attributes: { attributeName: string; value: string }[];
};

export type ProductDetail = {
  product: Tables<"products">;
  category: Tables<"categories"> | null;
  unit: Tables<"units"> | null;
  variants: VariantWithAttributes[];
};

/** Products in one company, RLS-scoped read. */
export async function listProducts(
  companyId: string,
): Promise<(Tables<"products"> & { variantCount: number })[]> {
  await requirePermission({ permission: PERMISSIONS.productsView, companyId });
  const supabase = await createServerSupabase();
  const [products, variants] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("company_id", companyId)
      .order("sku"),
    supabase
      .from("product_variants")
      .select("id, product_id")
      .eq("company_id", companyId),
  ]);
  if (products.error || variants.error) throw internal();
  return products.data.map((p) => ({
    ...p,
    variantCount: variants.data.filter((v) => v.product_id === p.id).length,
  }));
}

export async function getProductDetail(productId: string): Promise<ProductDetail> {
  const admin = createAdminSupabase();
  const { data: product } = await admin
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();
  if (!product) throw notFound("Product not found");
  await requirePermission({
    permission: PERMISSIONS.productsView,
    companyId: product.company_id,
  });

  const supabase = await createServerSupabase();
  const [category, unit, variants, vav, values, attributes] = await Promise.all([
    product.category_id
      ? supabase.from("categories").select("*").eq("id", product.category_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    product.unit_id
      ? supabase.from("units").select("*").eq("id", product.unit_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", product.id)
      .order("sku"),
    supabase
      .from("variant_attribute_values")
      .select("variant_id, attribute_id, attribute_value_id")
      .eq("company_id", product.company_id),
    supabase
      .from("attribute_values")
      .select("id, value")
      .eq("company_id", product.company_id),
    supabase
      .from("attributes")
      .select("id, name")
      .eq("company_id", product.company_id),
  ]);
  if (variants.error || vav.error || values.error || attributes.error) throw internal();

  const valueById = new Map(values.data.map((v) => [v.id, v.value]));
  const attrById = new Map(attributes.data.map((a) => [a.id, a.name]));

  return {
    product,
    category: category.data ?? null,
    unit: unit.data ?? null,
    variants: variants.data.map((variant) => ({
      ...variant,
      attributes: vav.data
        .filter((row) => row.variant_id === variant.id)
        .map((row) => ({
          attributeName: attrById.get(row.attribute_id) ?? "?",
          value: valueById.get(row.attribute_value_id) ?? "?",
        })),
    })),
  };
}

export async function createProduct(
  input: z.input<typeof createProductSchema>,
): Promise<Tables<"products">> {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await requirePermission({
    permission: PERMISSIONS.productsCreate,
    companyId: parsed.data.companyId,
  });
  const session = await requireActiveUser();
  const admin = createAdminSupabase();

  // Client-supplied category/unit must belong to the validated company
  // and be active.
  if (parsed.data.categoryId) {
    const { data: category } = await admin
      .from("categories")
      .select("id, company_id, status")
      .eq("id", parsed.data.categoryId)
      .maybeSingle();
    if (!category || category.company_id !== parsed.data.companyId) {
      throw invalidInput("Category does not belong to the selected company");
    }
    if (category.status !== "active") throw conflict("Category is archived");
  }
  if (parsed.data.unitId) {
    const { data: unit } = await admin
      .from("units")
      .select("id, company_id, status")
      .eq("id", parsed.data.unitId)
      .maybeSingle();
    if (!unit || unit.company_id !== parsed.data.companyId) {
      throw invalidInput("Unit does not belong to the selected company");
    }
    if (unit.status !== "active") throw conflict("Unit is archived");
  }

  const { data, error } = await admin
    .from("products")
    .insert({
      company_id: parsed.data.companyId,
      sku: parsed.data.sku,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      category_id: parsed.data.categoryId ?? null,
      unit_id: parsed.data.unitId ?? null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw conflict("This SKU already exists in the company");
    throw internal();
  }

  await writeAudit({
    module: "products",
    action: "product.created",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId,
    entityType: "product",
    entityId: data.id,
    newValue: { sku: data.sku, name: data.name, status: data.status },
  });
  return data;
}

export async function updateProduct(
  input: z.input<typeof updateProductSchema>,
): Promise<Tables<"products">> {
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const admin = createAdminSupabase();
  const { data: before } = await admin
    .from("products")
    .select("*")
    .eq("id", parsed.data.productId)
    .maybeSingle();
  if (!before) throw notFound("Product not found");
  if (before.status === "archived") throw conflict("Archived products cannot be edited");

  const ctx = await requirePermission({
    permission: PERMISSIONS.productsUpdate,
    companyId: before.company_id,
  });
  const session = await requireActiveUser();

  if (parsed.data.categoryId) {
    const { data: category } = await admin
      .from("categories")
      .select("id, company_id, status")
      .eq("id", parsed.data.categoryId)
      .maybeSingle();
    if (!category || category.company_id !== before.company_id) {
      throw invalidInput("Category does not belong to this company");
    }
    if (category.status !== "active") throw conflict("Category is archived");
  }
  if (parsed.data.unitId) {
    const { data: unit } = await admin
      .from("units")
      .select("id, company_id, status")
      .eq("id", parsed.data.unitId)
      .maybeSingle();
    if (!unit || unit.company_id !== before.company_id) {
      throw invalidInput("Unit does not belong to this company");
    }
    if (unit.status !== "active") throw conflict("Unit is archived");
  }

  const { data, error } = await admin
    .from("products")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      category_id: parsed.data.categoryId ?? null,
      unit_id: parsed.data.unitId ?? null,
      updated_by: ctx.userId,
    })
    .eq("id", before.id)
    .select()
    .single();
  if (error) throw internal();

  await writeAudit({
    module: "products",
    action: "product.updated",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: before.company_id,
    entityType: "product",
    entityId: before.id,
    previousValue: {
      name: before.name,
      description: before.description,
      category_id: before.category_id,
      unit_id: before.unit_id,
    },
    newValue: {
      name: data.name,
      description: data.description,
      category_id: data.category_id,
      unit_id: data.unit_id,
    },
  });
  return data;
}

/**
 * Product status machine: draft → active → archived → active.
 * Archiving a product archives its non-archived variants with it.
 */
export async function setProductStatus(
  input: z.input<typeof setProductStatusSchema>,
): Promise<void> {
  const parsed = setProductStatusSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const admin = createAdminSupabase();
  const { data: before } = await admin
    .from("products")
    .select("*")
    .eq("id", parsed.data.productId)
    .maybeSingle();
  if (!before) throw notFound("Product not found");

  const to = parsed.data.status;
  const permission =
    to === "archived" ? PERMISSIONS.productsArchive : PERMISSIONS.productsUpdate;
  const ctx = await requirePermission({
    permission,
    companyId: before.company_id,
  });
  const session = await requireActiveUser();

  if (!(PRODUCT_STATUS_TRANSITIONS[before.status] ?? []).includes(to)) {
    throw conflict(`Cannot change status from ${before.status} to ${to}`);
  }

  const { error } = await admin
    .from("products")
    .update({ status: to, updated_by: ctx.userId })
    .eq("id", before.id);
  if (error) throw internal();

  if (to === "archived") {
    const { error: variantError } = await admin
      .from("product_variants")
      .update({ status: "archived", updated_by: ctx.userId })
      .eq("product_id", before.id)
      .neq("status", "archived");
    if (variantError) throw internal();
  }

  await writeAudit({
    module: "products",
    action: to === "archived" ? "product.archived" : "product.status_changed",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: before.company_id,
    entityType: "product",
    entityId: before.id,
    previousValue: { status: before.status },
    newValue: { status: to },
    reason: parsed.data.reason,
  });
}

export async function createVariant(
  input: z.input<typeof createVariantSchema>,
): Promise<Tables<"product_variants">> {
  const parsed = createVariantSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const admin = createAdminSupabase();
  const { data: product } = await admin
    .from("products")
    .select("*")
    .eq("id", parsed.data.productId)
    .maybeSingle();
  if (!product) throw notFound("Product not found");
  if (product.status === "archived") {
    throw conflict("Archived products cannot receive new variants");
  }

  const ctx = await requirePermission({
    permission: PERMISSIONS.productsCreate,
    companyId: product.company_id,
  });
  const session = await requireActiveUser();

  // Resolve and validate the attribute values: each must belong to the
  // product's company, each to a distinct active attribute.
  const valueIds = [...new Set(parsed.data.attributeValueIds)];
  let resolved: { attributeId: string; valueId: string; value: string }[] = [];
  if (valueIds.length > 0) {
    const { data: values, error } = await admin
      .from("attribute_values")
      .select("id, attribute_id, company_id, value, status")
      .in("id", valueIds);
    if (error) throw internal();
    if ((values ?? []).length !== valueIds.length) {
      throw invalidInput("Unknown attribute value");
    }
    for (const v of values) {
      if (v.company_id !== product.company_id) {
        throw invalidInput("Attribute value does not belong to this company");
      }
      if (v.status !== "active") throw conflict("Attribute value is archived");
    }
    resolved = values.map((v) => ({
      attributeId: v.attribute_id,
      valueId: v.id,
      value: v.value,
    }));
    const attributeIds = resolved.map((r) => r.attributeId);
    if (new Set(attributeIds).size !== attributeIds.length) {
      throw invalidInput("At most one value per attribute");
    }
  }

  // Combination uniqueness across the product's variants.
  const { data: existingRows, error: vavError } = await admin
    .from("variant_attribute_values")
    .select("variant_id, attribute_value_id, product_variants!inner(product_id)")
    .eq("product_variants.product_id", product.id);
  if (vavError) throw internal();
  const byVariant = new Map<string, string[]>();
  for (const row of existingRows ?? []) {
    const list = byVariant.get(row.variant_id) ?? [];
    list.push(row.attribute_value_id);
    byVariant.set(row.variant_id, list);
  }
  // Attribute-less variants carry no combination to collide on and are
  // distinguished by their (already unique) SKU — bulk import creates
  // them that way, so treating the empty set as a collision would make
  // the two creation paths disagree.
  if (resolved.length > 0) {
    const fingerprint = (ids: string[]) => [...ids].sort().join("|");
    const newFp = fingerprint(resolved.map((r) => r.valueId));
    for (const ids of byVariant.values()) {
      if (fingerprint(ids) === newFp) {
        throw conflict("A variant with this attribute combination already exists");
      }
    }
  }

  const { data: variant, error: insertError } = await admin
    .from("product_variants")
    .insert({
      company_id: product.company_id,
      product_id: product.id,
      sku: parsed.data.sku,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select()
    .single();
  if (insertError) {
    if (insertError.code === "23505") {
      throw conflict("This variant SKU already exists in the company");
    }
    throw internal();
  }

  if (resolved.length > 0) {
    const { error: linkError } = await admin.from("variant_attribute_values").insert(
      resolved.map((r) => ({
        variant_id: variant.id,
        attribute_id: r.attributeId,
        attribute_value_id: r.valueId,
        company_id: product.company_id,
      })),
    );
    if (linkError) {
      // Keep the variant and its attribute rows consistent.
      await admin.from("product_variants").delete().eq("id", variant.id);
      throw internal("Variant attributes could not be recorded");
    }
  }

  await writeAudit({
    module: "products",
    action: "variant.created",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: product.company_id,
    entityType: "product_variant",
    entityId: variant.id,
    newValue: {
      product_sku: product.sku,
      sku: variant.sku,
      attributes: resolved.map((r) => r.value),
    },
  });
  return variant;
}

/** Variant status machine mirrors the product machine. */
export async function setVariantStatus(
  input: z.input<typeof setVariantStatusSchema>,
): Promise<void> {
  const parsed = setVariantStatusSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const admin = createAdminSupabase();
  const { data: before } = await admin
    .from("product_variants")
    .select("*, products!inner(status)")
    .eq("id", parsed.data.variantId)
    .maybeSingle();
  if (!before) throw notFound("Variant not found");

  const to = parsed.data.status;
  const permission =
    to === "archived" ? PERMISSIONS.productsArchive : PERMISSIONS.productsUpdate;
  const ctx = await requirePermission({
    permission,
    companyId: before.company_id,
  });
  const session = await requireActiveUser();

  if (!(PRODUCT_STATUS_TRANSITIONS[before.status] ?? []).includes(to)) {
    throw conflict(`Cannot change status from ${before.status} to ${to}`);
  }
  if (to === "active" && before.products.status === "archived") {
    throw conflict("Reactivate the product before its variants");
  }

  const { error } = await admin
    .from("product_variants")
    .update({ status: to, updated_by: ctx.userId })
    .eq("id", before.id);
  if (error) throw internal();

  await writeAudit({
    module: "products",
    action: to === "archived" ? "variant.archived" : "variant.status_changed",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: before.company_id,
    entityType: "product_variant",
    entityId: before.id,
    previousValue: { status: before.status },
    newValue: { status: to },
    reason: parsed.data.reason,
  });
}

/**
 * Confidential intelligence read. Requires products.intelligence.view;
 * every successful read is audited (product.intelligence_viewed).
 */
export async function getIntelligence(
  productId: string,
): Promise<Tables<"product_intelligence"> | null> {
  const admin = createAdminSupabase();
  const { data: product } = await admin
    .from("products")
    .select("id, company_id, sku")
    .eq("id", productId)
    .maybeSingle();
  if (!product) throw notFound("Product not found");

  const ctx = await requirePermission({
    permission: PERMISSIONS.productsIntelligenceView,
    companyId: product.company_id,
  });
  const session = await requireActiveUser();

  const { data, error } = await admin
    .from("product_intelligence")
    .select("*")
    .eq("product_id", product.id)
    .maybeSingle();
  if (error) throw internal();

  await writeAudit(
    {
      module: "products",
      action: "product.intelligence_viewed",
      actorUserId: ctx.userId,
      actorEmail: session.email,
      companyId: product.company_id,
      entityType: "product",
      entityId: product.id,
      newValue: { sku: product.sku, exists: Boolean(data) },
    },
    { critical: false },
  );
  return data;
}

export async function upsertIntelligence(
  input: z.input<typeof upsertIntelligenceSchema>,
): Promise<void> {
  const parsed = upsertIntelligenceSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const admin = createAdminSupabase();
  const { data: product } = await admin
    .from("products")
    .select("id, company_id, sku, status")
    .eq("id", parsed.data.productId)
    .maybeSingle();
  if (!product) throw notFound("Product not found");
  if (product.status === "archived") {
    throw conflict("Archived products cannot be edited");
  }

  // Writing confidential data requires BOTH the update permission and the
  // intelligence-view permission.
  await requirePermission({
    permission: PERMISSIONS.productsUpdate,
    companyId: product.company_id,
  });
  const ctx = await requirePermission({
    permission: PERMISSIONS.productsIntelligenceView,
    companyId: product.company_id,
  });
  const session = await requireActiveUser();

  const targetCost =
    parsed.data.targetCost && parsed.data.targetCost !== ""
      ? parsed.data.targetCost
      : null;
  const currency =
    parsed.data.targetCostCurrency && parsed.data.targetCostCurrency !== ""
      ? parsed.data.targetCostCurrency
      : null;
  if (targetCost !== null && currency === null) {
    throw invalidInput("A currency is required when a target cost is set");
  }

  const { data: before } = await admin
    .from("product_intelligence")
    .select("*")
    .eq("product_id", product.id)
    .maybeSingle();

  const row = {
    product_id: product.id,
    company_id: product.company_id,
    sourcing_notes: parsed.data.sourcingNotes || null,
    // numeric column: pass the validated decimal string, never a float
    target_cost: targetCost as unknown as number | null,
    target_cost_currency: currency,
    remarks: parsed.data.remarks || null,
    updated_by: ctx.userId,
    ...(before ? {} : { created_by: ctx.userId }),
  };
  const { error } = await admin
    .from("product_intelligence")
    .upsert(row, { onConflict: "product_id" });
  if (error) throw internal();

  // Confidential content is never copied into the audit log — the trail
  // records THAT it changed and which fields, not the values themselves.
  await writeAudit({
    module: "products",
    action: "product.intelligence_updated",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: product.company_id,
    entityType: "product",
    entityId: product.id,
    previousValue: before
      ? {
          fields_set: [
            before.sourcing_notes ? "sourcing_notes" : null,
            before.target_cost !== null ? "target_cost" : null,
            before.remarks ? "remarks" : null,
          ].filter(Boolean),
        }
      : null,
    newValue: {
      sku: product.sku,
      fields_set: [
        row.sourcing_notes ? "sourcing_notes" : null,
        row.target_cost !== null ? "target_cost" : null,
        row.remarks ? "remarks" : null,
      ].filter(Boolean),
    },
  });
}
