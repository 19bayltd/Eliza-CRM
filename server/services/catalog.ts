import "server-only";

import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireActiveUser } from "@/server/auth/session";
import { PERMISSIONS, requirePermission } from "@/server/permissions";
import { writeAudit } from "@/server/audit";
import { conflict, internal, invalidInput, notFound } from "@/server/errors";
import {
  archiveCatalogEntitySchema,
  createAttributeSchema,
  createAttributeValueSchema,
  createCategorySchema,
  createUnitSchema,
} from "@/server/validation/products";
import type { Tables } from "@/types/database";

/**
 * Product catalog service: units, categories, attributes, attribute
 * values. Archive-only lifecycle; writes require products.catalog.manage
 * in the target company and are audited.
 */

export type AttributeWithValues = Tables<"attributes"> & {
  values: Tables<"attribute_values">[];
};

/** Reads run on the user client so RLS applies. */
export async function listCatalog(companyId: string): Promise<{
  units: Tables<"units">[];
  categories: Tables<"categories">[];
  attributes: AttributeWithValues[];
}> {
  await requirePermission({ permission: PERMISSIONS.productsView, companyId });
  const supabase = await createServerSupabase();
  const [units, categories, attributes, values] = await Promise.all([
    supabase.from("units").select("*").eq("company_id", companyId).order("code"),
    supabase.from("categories").select("*").eq("company_id", companyId).order("code"),
    supabase.from("attributes").select("*").eq("company_id", companyId).order("code"),
    supabase
      .from("attribute_values")
      .select("*")
      .eq("company_id", companyId)
      .order("position")
      .order("value"),
  ]);
  if (units.error || categories.error || attributes.error || values.error) {
    throw internal();
  }
  return {
    units: units.data,
    categories: categories.data,
    attributes: attributes.data.map((a) => ({
      ...a,
      values: values.data.filter((v) => v.attribute_id === a.id),
    })),
  };
}

export async function createUnit(
  input: z.input<typeof createUnitSchema>,
): Promise<Tables<"units">> {
  const parsed = createUnitSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await requirePermission({
    permission: PERMISSIONS.productsCatalogManage,
    companyId: parsed.data.companyId,
  });
  const session = await requireActiveUser();
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("units")
    .insert({
      company_id: parsed.data.companyId,
      code: parsed.data.code,
      name: parsed.data.name,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw conflict("Unit code already exists in this company");
    throw internal();
  }
  await writeAudit({
    module: "products",
    action: "unit.created",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId,
    entityType: "unit",
    entityId: data.id,
    newValue: { code: data.code, name: data.name },
  });
  return data;
}

export async function createCategory(
  input: z.input<typeof createCategorySchema>,
): Promise<Tables<"categories">> {
  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await requirePermission({
    permission: PERMISSIONS.productsCatalogManage,
    companyId: parsed.data.companyId,
  });
  const session = await requireActiveUser();
  const admin = createAdminSupabase();

  if (parsed.data.parentId) {
    const { data: parent } = await admin
      .from("categories")
      .select("id, company_id, status")
      .eq("id", parsed.data.parentId)
      .maybeSingle();
    // Client-supplied parent must belong to the validated target company.
    if (!parent || parent.company_id !== parsed.data.companyId) {
      throw invalidInput("Parent category does not belong to the selected company");
    }
    if (parent.status !== "active") {
      throw conflict("Parent category is archived");
    }
  }

  const { data, error } = await admin
    .from("categories")
    .insert({
      company_id: parsed.data.companyId,
      parent_id: parsed.data.parentId ?? null,
      code: parsed.data.code,
      name: parsed.data.name,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw conflict("Category code already exists in this company");
    throw internal();
  }
  await writeAudit({
    module: "products",
    action: "category.created",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId,
    entityType: "category",
    entityId: data.id,
    newValue: { code: data.code, name: data.name, parent_id: data.parent_id },
  });
  return data;
}

export async function createAttribute(
  input: z.input<typeof createAttributeSchema>,
): Promise<Tables<"attributes">> {
  const parsed = createAttributeSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await requirePermission({
    permission: PERMISSIONS.productsCatalogManage,
    companyId: parsed.data.companyId,
  });
  const session = await requireActiveUser();
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("attributes")
    .insert({
      company_id: parsed.data.companyId,
      code: parsed.data.code,
      name: parsed.data.name,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw conflict("Attribute code already exists in this company");
    throw internal();
  }
  await writeAudit({
    module: "products",
    action: "attribute.created",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId,
    entityType: "attribute",
    entityId: data.id,
    newValue: { code: data.code, name: data.name },
  });
  return data;
}

export async function createAttributeValue(
  input: z.input<typeof createAttributeValueSchema>,
): Promise<Tables<"attribute_values">> {
  const parsed = createAttributeValueSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const admin = createAdminSupabase();
  const { data: attribute } = await admin
    .from("attributes")
    .select("id, company_id, code, status")
    .eq("id", parsed.data.attributeId)
    .maybeSingle();
  if (!attribute) throw notFound("Attribute not found");
  if (attribute.status !== "active") throw conflict("Attribute is archived");

  const ctx = await requirePermission({
    permission: PERMISSIONS.productsCatalogManage,
    companyId: attribute.company_id,
  });
  const session = await requireActiveUser();

  const { data, error } = await admin
    .from("attribute_values")
    .insert({
      company_id: attribute.company_id,
      attribute_id: attribute.id,
      value: parsed.data.value,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw conflict("This value already exists for the attribute");
    throw internal();
  }
  await writeAudit({
    module: "products",
    action: "attribute.value_added",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: attribute.company_id,
    entityType: "attribute",
    entityId: attribute.id,
    newValue: { attribute: attribute.code, value: data.value },
  });
  return data;
}

type CatalogKind = "unit" | "category" | "attribute";

const CATALOG_TABLES: Record<CatalogKind, "units" | "categories" | "attributes"> = {
  unit: "units",
  category: "categories",
  attribute: "attributes",
};

/**
 * Archive a catalog entity. Refused while active products still reference
 * it (units/categories) or while a category has active children.
 */
export async function archiveCatalogEntity(
  kind: CatalogKind,
  input: z.input<typeof archiveCatalogEntitySchema>,
): Promise<void> {
  const parsed = archiveCatalogEntitySchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const admin = createAdminSupabase();
  const table = CATALOG_TABLES[kind];
  const { data: before } = await admin
    .from(table)
    .select("*")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!before) throw notFound(`${kind} not found`);
  if (before.status === "archived") throw conflict(`${kind} is already archived`);

  const ctx = await requirePermission({
    permission: PERMISSIONS.productsCatalogManage,
    companyId: before.company_id,
  });
  const session = await requireActiveUser();

  if (kind === "unit") {
    const { count } = await admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", before.id)
      .neq("status", "archived");
    if (count) throw conflict(`Cannot archive: ${count} non-archived product(s) use this unit`);
  }
  if (kind === "category") {
    const [{ count: productCount }, { count: childCount }] = await Promise.all([
      admin
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("category_id", before.id)
        .neq("status", "archived"),
      admin
        .from("categories")
        .select("id", { count: "exact", head: true })
        .eq("parent_id", before.id)
        .eq("status", "active"),
    ]);
    if (productCount) {
      throw conflict(`Cannot archive: ${productCount} non-archived product(s) in this category`);
    }
    if (childCount) {
      throw conflict(`Cannot archive: ${childCount} active sub-categor(ies) under this category`);
    }
  }
  if (kind === "attribute") {
    const { count } = await admin
      .from("variant_attribute_values")
      .select("variant_id", { count: "exact", head: true })
      .eq("attribute_id", before.id);
    if (count) throw conflict(`Cannot archive: ${count} variant value(s) use this attribute`);
  }

  const { error } = await admin
    .from(table)
    .update({ status: "archived", updated_by: ctx.userId })
    .eq("id", before.id);
  if (error) throw internal();

  await writeAudit({
    module: "products",
    action: `${kind}.archived`,
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: before.company_id,
    entityType: kind,
    entityId: before.id,
    previousValue: { status: before.status },
    newValue: { status: "archived" },
    reason: parsed.data.reason,
  });
}
