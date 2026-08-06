import "server-only";

import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireActiveUser } from "@/server/auth/session";
import { PERMISSIONS, requirePermission } from "@/server/permissions";
import { writeAudit } from "@/server/audit";
import { conflict, internal, invalidInput, notFound } from "@/server/errors";
import {
  archiveSupplierEntitySchema,
  createContactSchema,
  createSupplierSchema,
  updateSupplierSchema,
} from "@/server/validation/suppliers";
import type { Tables } from "@/types/database";

/**
 * Supplier directory service: suppliers and their contacts. Archive-only
 * lifecycle; a supplier with active quotations cannot be archived.
 */

export async function listSuppliers(
  companyId: string,
): Promise<(Tables<"suppliers"> & { contactCount: number; quotationCount: number })[]> {
  await requirePermission({ permission: PERMISSIONS.suppliersView, companyId });
  const supabase = await createServerSupabase();
  const [suppliers, contacts, quotations] = await Promise.all([
    supabase.from("suppliers").select("*").eq("company_id", companyId).order("code"),
    supabase
      .from("supplier_contacts")
      .select("id, supplier_id")
      .eq("company_id", companyId)
      .eq("status", "active"),
    // May be empty for callers without quotation.view — counts show 0.
    supabase
      .from("supplier_quotations")
      .select("id, supplier_id")
      .eq("company_id", companyId)
      .eq("status", "active"),
  ]);
  if (suppliers.error || contacts.error || quotations.error) throw internal();
  return suppliers.data.map((s) => ({
    ...s,
    contactCount: (contacts.data ?? []).filter((c) => c.supplier_id === s.id).length,
    quotationCount: (quotations.data ?? []).filter((q) => q.supplier_id === s.id).length,
  }));
}

export type SupplierDetail = {
  supplier: Tables<"suppliers">;
  contacts: Tables<"supplier_contacts">[];
};

export async function getSupplierDetail(supplierId: string): Promise<SupplierDetail> {
  const admin = createAdminSupabase();
  const { data: supplier } = await admin
    .from("suppliers")
    .select("*")
    .eq("id", supplierId)
    .maybeSingle();
  if (!supplier) throw notFound("Supplier not found");
  await requirePermission({
    permission: PERMISSIONS.suppliersView,
    companyId: supplier.company_id,
  });
  const supabase = await createServerSupabase();
  const { data: contacts, error } = await supabase
    .from("supplier_contacts")
    .select("*")
    .eq("supplier_id", supplier.id)
    .order("created_at");
  if (error) throw internal();
  return { supplier, contacts };
}

export async function createSupplier(
  input: z.input<typeof createSupplierSchema>,
): Promise<Tables<"suppliers">> {
  const parsed = createSupplierSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await requirePermission({
    permission: PERMISSIONS.suppliersManage,
    companyId: parsed.data.companyId,
  });
  const session = await requireActiveUser();
  const admin = createAdminSupabase();

  const { data, error } = await admin
    .from("suppliers")
    .insert({
      company_id: parsed.data.companyId,
      code: parsed.data.code,
      name: parsed.data.name,
      country: parsed.data.country,
      address: parsed.data.address ?? null,
      capabilities: parsed.data.capabilities ?? null,
      notes: parsed.data.notes ?? null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw conflict("Supplier code already exists in this company");
    throw internal();
  }

  await writeAudit({
    module: "suppliers",
    action: "supplier.created",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId,
    entityType: "supplier",
    entityId: data.id,
    newValue: { code: data.code, name: data.name, country: data.country },
  });
  return data;
}

export async function updateSupplier(
  input: z.input<typeof updateSupplierSchema>,
): Promise<Tables<"suppliers">> {
  const parsed = updateSupplierSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const admin = createAdminSupabase();
  const { data: before } = await admin
    .from("suppliers")
    .select("*")
    .eq("id", parsed.data.supplierId)
    .maybeSingle();
  if (!before) throw notFound("Supplier not found");
  if (before.status === "archived") throw conflict("Archived suppliers cannot be edited");

  const ctx = await requirePermission({
    permission: PERMISSIONS.suppliersManage,
    companyId: before.company_id,
  });
  const session = await requireActiveUser();

  const { data, error } = await admin
    .from("suppliers")
    .update({
      name: parsed.data.name,
      country: parsed.data.country,
      address: parsed.data.address ?? null,
      capabilities: parsed.data.capabilities ?? null,
      notes: parsed.data.notes ?? null,
      updated_by: ctx.userId,
    })
    .eq("id", before.id)
    .select()
    .single();
  if (error) throw internal();

  await writeAudit({
    module: "suppliers",
    action: "supplier.updated",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: before.company_id,
    entityType: "supplier",
    entityId: before.id,
    previousValue: {
      name: before.name,
      country: before.country,
      address: before.address,
      capabilities: before.capabilities,
    },
    newValue: {
      name: data.name,
      country: data.country,
      address: data.address,
      capabilities: data.capabilities,
    },
  });
  return data;
}

export async function archiveSupplier(
  input: z.input<typeof archiveSupplierEntitySchema>,
): Promise<void> {
  const parsed = archiveSupplierEntitySchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const admin = createAdminSupabase();
  const { data: before } = await admin
    .from("suppliers")
    .select("*")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!before) throw notFound("Supplier not found");
  if (before.status === "archived") throw conflict("Supplier is already archived");

  const ctx = await requirePermission({
    permission: PERMISSIONS.suppliersManage,
    companyId: before.company_id,
  });
  const session = await requireActiveUser();

  const { count } = await admin
    .from("supplier_quotations")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", before.id)
    .eq("status", "active");
  if (count) {
    // No count in the message: quotation existence detail is gated by a
    // permission the archiving user may not hold (review finding).
    throw conflict("Cannot archive: active quotations reference this supplier");
  }

  const { error } = await admin
    .from("suppliers")
    .update({ status: "archived", updated_by: ctx.userId })
    .eq("id", before.id);
  if (error) throw internal();

  await writeAudit({
    module: "suppliers",
    action: "supplier.archived",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: before.company_id,
    entityType: "supplier",
    entityId: before.id,
    previousValue: { status: before.status },
    newValue: { status: "archived" },
    reason: parsed.data.reason,
  });
}

export async function addContact(
  input: z.input<typeof createContactSchema>,
): Promise<Tables<"supplier_contacts">> {
  const parsed = createContactSchema.safeParse(input);
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
  if (supplier.status === "archived") {
    throw conflict("Archived suppliers cannot receive new contacts");
  }

  const ctx = await requirePermission({
    permission: PERMISSIONS.suppliersManage,
    companyId: supplier.company_id,
  });
  const session = await requireActiveUser();

  const { data, error } = await admin
    .from("supplier_contacts")
    .insert({
      company_id: supplier.company_id,
      supplier_id: supplier.id,
      name: parsed.data.name,
      role_title: parsed.data.roleTitle ?? null,
      phone: parsed.data.phone ?? null,
      messaging: parsed.data.messaging ?? null,
      email: parsed.data.email ?? null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select()
    .single();
  if (error) throw internal();

  await writeAudit({
    module: "suppliers",
    action: "supplier.contact_added",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: supplier.company_id,
    entityType: "supplier",
    entityId: supplier.id,
    newValue: { supplier: supplier.code, contact: data.name },
  });
  return data;
}

export async function archiveContact(
  input: z.input<typeof archiveSupplierEntitySchema>,
): Promise<void> {
  const parsed = archiveSupplierEntitySchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const admin = createAdminSupabase();
  const { data: before } = await admin
    .from("supplier_contacts")
    .select("*, suppliers!supplier_contacts_supplier_id_fkey!inner(code)")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!before) throw notFound("Contact not found");
  if (before.status === "archived") throw conflict("Contact is already archived");

  const ctx = await requirePermission({
    permission: PERMISSIONS.suppliersManage,
    companyId: before.company_id,
  });
  const session = await requireActiveUser();

  const { error } = await admin
    .from("supplier_contacts")
    .update({ status: "archived", updated_by: ctx.userId })
    .eq("id", before.id);
  if (error) throw internal();

  await writeAudit({
    module: "suppliers",
    action: "supplier.contact_archived",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: before.company_id,
    entityType: "supplier",
    entityId: before.supplier_id,
    previousValue: { supplier: before.suppliers.code, contact: before.name },
    reason: parsed.data.reason,
  });
}
