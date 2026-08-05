import "server-only";

import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/server/auth/session";
import { PERMISSIONS, requirePermission } from "@/server/permissions";
import { writeAudit } from "@/server/audit";
import { conflict, internal, invalidInput, notFound } from "@/server/errors";
import {
  IMPORT_COLUMNS,
  importApplySchema,
  importValidateSchema,
  parseCsv,
  planImportRows,
} from "@/server/validation/products";
import type { Json, Tables } from "@/types/database";

/**
 * Product CSV import pipeline: validate (plan, nothing written to the
 * catalog) → apply (execute the stored plan) — never a silent partial
 * import. Every job and every row outcome is stored and auditable.
 * The pure planning core lives in validation/products (unit-tested).
 */

const MAX_ROWS = 2000;

export type ImportPlan = {
  jobId: string;
  rowsTotal: number;
  rowsCreate: number;
  rowsUpdate: number;
  rowsReject: number;
  rejects: { rowNumber: number; message: string }[];
};

export async function validateImport(
  input: z.input<typeof importValidateSchema>,
): Promise<ImportPlan> {
  const parsed = importValidateSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await requirePermission({
    permission: PERMISSIONS.productsImport,
    companyId: parsed.data.companyId,
  });
  const session = await requireActiveUser();

  const { header, rows } = parseCsv(parsed.data.csv);
  const missing = IMPORT_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    throw invalidInput(`CSV is missing required column(s): ${missing.join(", ")}`);
  }
  if (rows.length === 0) throw invalidInput("The CSV contains no data rows");
  if (rows.length > MAX_ROWS) {
    throw invalidInput(`Too many rows (${rows.length}); the limit is ${MAX_ROWS} per import`);
  }

  const admin = createAdminSupabase();
  const [products, variants, categories, units] = await Promise.all([
    admin.from("products").select("sku").eq("company_id", parsed.data.companyId),
    admin.from("product_variants").select("sku").eq("company_id", parsed.data.companyId),
    admin
      .from("categories")
      .select("code")
      .eq("company_id", parsed.data.companyId)
      .eq("status", "active"),
    admin
      .from("units")
      .select("code")
      .eq("company_id", parsed.data.companyId)
      .eq("status", "active"),
  ]);
  if (products.error || variants.error || categories.error || units.error) {
    throw internal();
  }

  const planned = planImportRows({
    header,
    rows,
    existingProductSkus: new Set(products.data.map((p) => p.sku)),
    existingVariantSkus: new Set(variants.data.map((v) => v.sku)),
    activeCategoryCodes: new Set(categories.data.map((c) => c.code)),
    activeUnitCodes: new Set(units.data.map((u) => u.code)),
  });

  const counts = {
    rowsTotal: planned.length,
    rowsCreate: planned.filter(
      (r) => r.action === "create_product" || r.action === "create_variant",
    ).length,
    rowsUpdate: planned.filter((r) => r.action === "update_product").length,
    rowsReject: planned.filter((r) => r.action === "reject").length,
  };

  const { data: job, error: jobError } = await admin
    .from("import_jobs")
    .insert({
      company_id: parsed.data.companyId,
      module: "products",
      filename: parsed.data.filename,
      rows_total: counts.rowsTotal,
      rows_create: counts.rowsCreate,
      rows_update: counts.rowsUpdate,
      rows_reject: counts.rowsReject,
      created_by: ctx.userId,
    })
    .select()
    .single();
  if (jobError) throw internal();

  const { error: rowsError } = await admin.from("import_job_rows").insert(
    planned.map((r) => ({
      job_id: job.id,
      company_id: parsed.data.companyId,
      row_number: r.rowNumber,
      raw: r.raw as Json,
      planned_action: r.action,
      message: r.message,
    })),
  );
  if (rowsError) throw internal("Import rows could not be stored");

  await writeAudit({
    module: "products",
    action: "import.validated",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId,
    entityType: "import_job",
    entityId: job.id,
    newValue: { filename: parsed.data.filename, ...counts },
  });

  return {
    jobId: job.id,
    ...counts,
    rejects: planned
      .filter((r) => r.action === "reject")
      .map((r) => ({ rowNumber: r.rowNumber, message: r.message ?? "rejected" })),
  };
}

export async function applyImport(
  input: z.input<typeof importApplySchema>,
): Promise<{ applied: number; failed: number }> {
  const parsed = importApplySchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const admin = createAdminSupabase();
  const { data: job } = await admin
    .from("import_jobs")
    .select("*")
    .eq("id", parsed.data.jobId)
    .maybeSingle();
  if (!job) throw notFound("Import job not found");
  if (job.status !== "validated") {
    throw conflict(`This import was already ${job.status}`);
  }

  // Applying writes products, so the full write permission set is required.
  const ctx = await requirePermission({
    permission: PERMISSIONS.productsImport,
    companyId: job.company_id,
  });
  await requirePermission({
    permission: PERMISSIONS.productsCreate,
    companyId: job.company_id,
  });
  await requirePermission({
    permission: PERMISSIONS.productsUpdate,
    companyId: job.company_id,
  });
  const session = await requireActiveUser();

  const { data: rows, error: rowsError } = await admin
    .from("import_job_rows")
    .select("*")
    .eq("job_id", job.id)
    .order("row_number");
  if (rowsError) throw internal();

  const [categories, units] = await Promise.all([
    admin
      .from("categories")
      .select("id, code")
      .eq("company_id", job.company_id)
      .eq("status", "active"),
    admin
      .from("units")
      .select("id, code")
      .eq("company_id", job.company_id)
      .eq("status", "active"),
  ]);
  if (categories.error || units.error) throw internal();
  const categoryByCode = new Map(categories.data.map((c) => [c.code, c.id]));
  const unitByCode = new Map(units.data.map((u) => [u.code, u.id]));

  const productIdBySku = new Map<string, string>();
  let applied = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    if (row.planned_action === "reject" || row.applied) continue;
    const raw = row.raw as Record<string, string>;
    const fail = async (message: string) => {
      failed += 1;
      await admin
        .from("import_job_rows")
        .update({ message: `apply_failed: ${message}` })
        .eq("id", row.id);
    };
    try {
      if (row.planned_action === "create_product") {
        const { data: product, error } = await admin
          .from("products")
          .insert({
            company_id: job.company_id,
            sku: raw.sku ?? "",
            name: raw.name ?? "",
            description: raw.description || null,
            category_id: raw.category_code
              ? (categoryByCode.get(raw.category_code) ?? null)
              : null,
            unit_id: raw.unit_code ? (unitByCode.get(raw.unit_code) ?? null) : null,
            created_by: ctx.userId,
            updated_by: ctx.userId,
          })
          .select("id, sku")
          .single();
        if (error) {
          await fail(error.code === "23505" ? "SKU already exists" : "insert failed");
          continue;
        }
        productIdBySku.set(product.sku, product.id);
        if (raw.variant_sku) {
          const { error: variantError } = await admin.from("product_variants").insert({
            company_id: job.company_id,
            product_id: product.id,
            sku: raw.variant_sku,
            created_by: ctx.userId,
            updated_by: ctx.userId,
          });
          if (variantError) {
            await fail(
              variantError.code === "23505"
                ? "variant SKU already exists"
                : "variant insert failed",
            );
            continue;
          }
        }
      } else if (row.planned_action === "create_variant") {
        let productId = productIdBySku.get(raw.sku ?? "");
        if (!productId) {
          const { data: product } = await admin
            .from("products")
            .select("id")
            .eq("company_id", job.company_id)
            .eq("sku", raw.sku ?? "")
            .maybeSingle();
          productId = product?.id;
          if (productId) productIdBySku.set(raw.sku ?? "", productId);
        }
        if (!productId) {
          await fail(`product ${raw.sku} not found`);
          continue;
        }
        const { error } = await admin.from("product_variants").insert({
          company_id: job.company_id,
          product_id: productId,
          sku: raw.variant_sku ?? "",
          created_by: ctx.userId,
          updated_by: ctx.userId,
        });
        if (error) {
          await fail(error.code === "23505" ? "variant SKU already exists" : "insert failed");
          continue;
        }
      } else if (row.planned_action === "update_product") {
        const update: {
          updated_by: string;
          name?: string;
          description?: string;
          category_id?: string | null;
          unit_id?: string | null;
        } = { updated_by: ctx.userId };
        if (raw.name) update.name = raw.name;
        if (raw.description) update.description = raw.description;
        if (raw.category_code) {
          update.category_id = categoryByCode.get(raw.category_code) ?? null;
        }
        if (raw.unit_code) update.unit_id = unitByCode.get(raw.unit_code) ?? null;
        const { error, count } = await admin
          .from("products")
          .update(update, { count: "exact" })
          .eq("company_id", job.company_id)
          .eq("sku", raw.sku ?? "")
          .neq("status", "archived");
        if (error || !count) {
          await fail(error ? "update failed" : "product not found or archived");
          continue;
        }
      }
      applied += 1;
      await admin.from("import_job_rows").update({ applied: true }).eq("id", row.id);
    } catch {
      await fail("unexpected error");
    }
  }

  const { error: jobUpdateError } = await admin
    .from("import_jobs")
    .update({
      status: "applied",
      applied_at: new Date().toISOString(),
      applied_by: ctx.userId,
    })
    .eq("id", job.id);
  if (jobUpdateError) throw internal();

  await writeAudit({
    module: "products",
    action: "import.applied",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: job.company_id,
    entityType: "import_job",
    entityId: job.id,
    newValue: { filename: job.filename, applied, failed, rejected: job.rows_reject },
  });
  return { applied, failed };
}

export async function discardImport(
  input: z.input<typeof importApplySchema>,
): Promise<void> {
  const parsed = importApplySchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const admin = createAdminSupabase();
  const { data: job } = await admin
    .from("import_jobs")
    .select("*")
    .eq("id", parsed.data.jobId)
    .maybeSingle();
  if (!job) throw notFound("Import job not found");
  if (job.status !== "validated") throw conflict(`This import was already ${job.status}`);

  const ctx = await requirePermission({
    permission: PERMISSIONS.productsImport,
    companyId: job.company_id,
  });
  const session = await requireActiveUser();

  const { error } = await admin
    .from("import_jobs")
    .update({ status: "discarded" })
    .eq("id", job.id);
  if (error) throw internal();

  await writeAudit({
    module: "products",
    action: "import.discarded",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: job.company_id,
    entityType: "import_job",
    entityId: job.id,
    previousValue: { filename: job.filename, rows_total: job.rows_total },
  });
}

/** Import jobs in one company (permission-gated read). */
export async function listImportJobs(companyId: string): Promise<Tables<"import_jobs">[]> {
  await requirePermission({ permission: PERMISSIONS.productsImport, companyId });
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("import_jobs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw internal();
  return data;
}

/** Rejected/failed rows of one job, for the result report. */
export async function listImportIssues(jobId: string): Promise<Tables<"import_job_rows">[]> {
  const parsed = importApplySchema.safeParse({ jobId });
  if (!parsed.success) throw invalidInput("Invalid identifier");
  const admin = createAdminSupabase();
  const { data: job } = await admin
    .from("import_jobs")
    .select("id, company_id")
    .eq("id", parsed.data.jobId)
    .maybeSingle();
  if (!job) throw notFound("Import job not found");
  await requirePermission({
    permission: PERMISSIONS.productsImport,
    companyId: job.company_id,
  });
  const { data, error } = await admin
    .from("import_job_rows")
    .select("*")
    .eq("job_id", job.id)
    .or("planned_action.eq.reject,applied.eq.false")
    .order("row_number");
  if (error) throw internal();
  return data;
}
