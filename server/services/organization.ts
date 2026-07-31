import "server-only";

import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireActiveUser } from "@/server/auth/session";
import { PERMISSIONS, requirePermission, requireGlobalPermission } from "@/server/permissions";
import { writeAudit } from "@/server/audit";
import { conflict, internal, invalidInput, notFound } from "@/server/errors";
import {
  archiveEntitySchema,
  createBranchSchema,
  createCompanySchema,
  createDepartmentSchema,
  createWarehouseSchema,
  updateCompanySchema,
} from "@/server/validation/organization";
import type { Tables } from "@/types/database";

/** Companies visible to the caller — reads via the user client so RLS applies. */
export async function listCompanies(): Promise<Tables<"companies">[]> {
  await requireActiveUser();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("code");
  if (error) throw internal();
  return data;
}

export async function listCompanyChildren(companyId: string): Promise<{
  branches: Tables<"branches">[];
  warehouses: Tables<"warehouses">[];
  departments: Tables<"departments">[];
}> {
  await requirePermission({
    permission: PERMISSIONS.companyView,
    companyId,
  });
  const supabase = await createServerSupabase();
  const [branches, warehouses, departments] = await Promise.all([
    supabase.from("branches").select("*").eq("company_id", companyId).order("code"),
    supabase.from("warehouses").select("*").eq("company_id", companyId).order("code"),
    supabase.from("departments").select("*").eq("company_id", companyId).order("code"),
  ]);
  if (branches.error || warehouses.error || departments.error) throw internal();
  return {
    branches: branches.data,
    warehouses: warehouses.data,
    departments: departments.data,
  };
}

export async function createCompany(
  input: z.input<typeof createCompanySchema>,
): Promise<Tables<"companies">> {
  const parsed = createCompanySchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await requireGlobalPermission(PERMISSIONS.companyCreate);
  const session = await requireActiveUser();
  const admin = createAdminSupabase();

  const { data, error } = await admin
    .from("companies")
    .insert({
      code: parsed.data.code,
      name: parsed.data.name,
      base_currency: parsed.data.baseCurrency,
      timezone: parsed.data.timezone,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw conflict("Company code already exists");
    throw internal();
  }

  // Creator gets scope on the new company so it is immediately visible.
  await admin
    .from("user_company_scopes")
    .insert({ user_id: ctx.userId, company_id: data.id, created_by: ctx.userId });

  await writeAudit({
    module: "organization",
    action: "company.created",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: data.id,
    entityType: "company",
    entityId: data.id,
    newValue: { code: data.code, name: data.name, base_currency: data.base_currency, timezone: data.timezone },
  });
  return data;
}

export async function updateCompany(
  input: z.input<typeof updateCompanySchema>,
): Promise<Tables<"companies">> {
  const parsed = updateCompanySchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await requirePermission({
    permission: PERMISSIONS.companyUpdate,
    companyId: parsed.data.companyId,
  });
  const session = await requireActiveUser();
  const admin = createAdminSupabase();

  const { data: before } = await admin
    .from("companies")
    .select("*")
    .eq("id", parsed.data.companyId)
    .maybeSingle();
  if (!before) throw notFound("Company not found");
  if (before.status !== "active") throw conflict("Archived companies cannot be edited");

  const { data, error } = await admin
    .from("companies")
    .update({
      name: parsed.data.name,
      base_currency: parsed.data.baseCurrency,
      timezone: parsed.data.timezone,
      updated_by: ctx.userId,
    })
    .eq("id", parsed.data.companyId)
    .select()
    .single();
  if (error) throw internal();

  await writeAudit({
    module: "organization",
    action: "company.updated",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: data.id,
    entityType: "company",
    entityId: data.id,
    previousValue: { name: before.name, base_currency: before.base_currency, timezone: before.timezone },
    newValue: { name: data.name, base_currency: data.base_currency, timezone: data.timezone },
  });
  return data;
}

type OrgChild = "branch" | "warehouse" | "department";

const CHILD_CONFIG = {
  branch: {
    table: "branches",
    permission: PERMISSIONS.branchManage,
  },
  warehouse: {
    table: "warehouses",
    permission: PERMISSIONS.warehouseManage,
  },
  department: {
    table: "departments",
    permission: PERMISSIONS.departmentManage,
  },
} as const;

async function assertCompanyActive(companyId: string): Promise<void> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("companies")
    .select("id, status")
    .eq("id", companyId)
    .maybeSingle();
  if (!data) throw notFound("Company not found");
  if (data.status !== "active") throw conflict("Company is archived");
}

export async function createBranch(input: z.input<typeof createBranchSchema>) {
  return createChild("branch", createBranchSchema.safeParse(input));
}
export async function createWarehouse(input: z.input<typeof createWarehouseSchema>) {
  return createChild("warehouse", createWarehouseSchema.safeParse(input));
}
export async function createDepartment(input: z.input<typeof createDepartmentSchema>) {
  return createChild("department", createDepartmentSchema.safeParse(input));
}

async function createChild(
  kind: OrgChild,
  parsed:
    | { success: true; data: { companyId: string; branchId?: string; code: string; name: string } }
    | { success: false; error: z.ZodError },
) {
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const cfg = CHILD_CONFIG[kind];
  const ctx = await requirePermission({
    permission: cfg.permission,
    companyId: parsed.data.companyId,
  });
  const session = await requireActiveUser();
  await assertCompanyActive(parsed.data.companyId);

  const admin = createAdminSupabase();
  if (parsed.data.branchId) {
    const { data: branch } = await admin
      .from("branches")
      .select("id, company_id")
      .eq("id", parsed.data.branchId)
      .maybeSingle();
    // Client-supplied branch must belong to the (validated) target company.
    if (!branch || branch.company_id !== parsed.data.companyId) {
      throw invalidInput("Branch does not belong to the selected company");
    }
  }

  const row: Record<string, unknown> = {
    company_id: parsed.data.companyId,
    code: parsed.data.code,
    name: parsed.data.name,
    created_by: ctx.userId,
    updated_by: ctx.userId,
  };
  if (kind !== "branch" && parsed.data.branchId) row.branch_id = parsed.data.branchId;

  const { data, error } = await admin
    .from(cfg.table)
    .insert(row as never)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw conflict(`${kind} code already exists in this company`);
    throw internal();
  }

  const created = data as { id: string; code: string; name: string };
  await writeAudit({
    module: "organization",
    action: `${kind}.created`,
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId,
    entityType: kind,
    entityId: created.id,
    newValue: { code: created.code, name: created.name },
  });
  return created;
}

export async function archiveOrgEntity(
  kind: OrgChild | "company",
  input: z.input<typeof archiveEntitySchema>,
): Promise<void> {
  const parsed = archiveEntitySchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const admin = createAdminSupabase();
  const table = kind === "company" ? "companies" : CHILD_CONFIG[kind].table;

  const { data: before } = await admin
    .from(table)
    .select("*")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!before) throw notFound(`${kind} not found`);

  const record = before as { id: string; status: string; company_id?: string };
  const companyId = kind === "company" ? record.id : record.company_id;
  if (!companyId) throw internal();

  const ctx = await requirePermission({
    permission:
      kind === "company" ? PERMISSIONS.companyArchive : CHILD_CONFIG[kind].permission,
    companyId,
  });
  const session = await requireActiveUser();

  if (record.status === "archived") throw conflict(`${kind} is already archived`);

  const { error } = await admin
    .from(table)
    .update({ status: "archived", updated_by: ctx.userId } as never)
    .eq("id", parsed.data.id);
  if (error) throw internal();

  await writeAudit({
    module: "organization",
    action: `${kind}.archived`,
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId,
    entityType: kind,
    entityId: record.id,
    previousValue: { status: record.status },
    newValue: { status: "archived" },
    reason: parsed.data.reason,
  });
}
