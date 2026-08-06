import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireActiveUser } from "@/server/auth/session";
import { PERMISSIONS, requirePermission } from "@/server/permissions";
import { writeAudit } from "@/server/audit";
import { conflict, internal, invalidInput, notFound } from "@/server/errors";
import {
  cancelSampleSchema,
  createSampleSchema,
  evaluateSampleSchema,
  sampleTransitionSchema,
} from "@/server/validation/purchasing";
import type { Tables } from "@/types/database";

/**
 * Sample requests: the evaluation step that usually precedes a bulk
 * commitment. Strictly ordered — a sample cannot be received before it
 * was dispatched, or evaluated before it arrived — because the dates
 * are the evidence trail for a supplier dispute.
 */

export type SampleEntry = Tables<"sample_requests"> & {
  supplierCode: string;
  productSku: string | null;
};

const NEXT_STATUS = {
  dispatched: { from: "requested", action: "sample.dispatched" },
  received: { from: "dispatched", action: "sample.received" },
} as const;

async function loadSampleOr404(sampleId: string) {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("sample_requests")
    .select("*")
    .eq("id", sampleId)
    .maybeSingle();
  if (!data) throw notFound("Sample request not found");
  return data;
}

export async function listSamples(companyId: string): Promise<SampleEntry[]> {
  await requirePermission({ permission: PERMISSIONS.purchasingSampleView, companyId });
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("sample_requests")
    .select(
      "*, suppliers!sample_requests_supplier_id_fkey!inner(code), products!sample_requests_product_id_fkey(sku)",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw internal();
  return (data ?? []).map((row) => {
    const { suppliers, products, ...sample } = row;
    return {
      ...sample,
      supplierCode: suppliers.code,
      productSku: products?.sku ?? null,
    };
  });
}

export async function createSample(input: unknown): Promise<string> {
  const parsed = createSampleSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingSampleManage,
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
    throw conflict("Archived suppliers cannot receive sample requests");
  }

  if (parsed.data.productId) {
    const { data: product } = await admin
      .from("products")
      .select("id, company_id")
      .eq("id", parsed.data.productId)
      .maybeSingle();
    if (!product || product.company_id !== parsed.data.companyId) {
      throw invalidInput("Product does not belong to this company");
    }
  }

  const { data: number, error: numberError } = await admin.rpc("next_document_number", {
    p_company_id: parsed.data.companyId,
    p_doc_type: "SR",
  });
  if (numberError || !number) throw internal("Could not allocate a sample number");

  const { data: sample, error } = await admin
    .from("sample_requests")
    .insert({
      company_id: parsed.data.companyId,
      number,
      supplier_id: supplier.id,
      product_id: parsed.data.productId ?? null,
      variant_id: parsed.data.variantId ?? null,
      description: parsed.data.description,
      quantity: parsed.data.quantity,
      purpose: parsed.data.purpose ?? null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id, number")
    .single();
  if (error || !sample) throw internal("Sample request could not be created");

  await writeAudit({
    module: "purchasing",
    action: "sample.requested",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId,
    entityType: "sample_request",
    entityId: sample.id,
    newValue: { number: sample.number, supplier: supplier.code },
  });
  return sample.id;
}

/** Advance a sample one step; skipping a step is refused. */
export async function advanceSample(
  target: "dispatched" | "received",
  input: unknown,
): Promise<void> {
  const parsed = sampleTransitionSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const sample = await loadSampleOr404(parsed.data.sampleId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingSampleManage,
    companyId: sample.company_id,
  });
  const session = await requireActiveUser();

  const rule = NEXT_STATUS[target];
  if (sample.status !== rule.from) {
    throw conflict(`Only ${rule.from} samples can be marked ${target}`);
  }

  const now = new Date().toISOString();
  const admin = createAdminSupabase();
  const { data: updated, error } = await admin
    .from("sample_requests")
    .update({
      status: target,
      ...(target === "dispatched"
        ? { dispatched_at: now, tracking_ref: parsed.data.trackingRef ?? null }
        : { received_at: now }),
      updated_by: ctx.userId,
    })
    .eq("id", sample.id)
    .eq("status", rule.from)
    .select("id")
    .maybeSingle();
  if (error) throw internal();
  if (!updated) throw conflict("The sample moved on already");

  await writeAudit({
    module: "purchasing",
    action: rule.action,
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: sample.company_id,
    entityType: "sample_request",
    entityId: sample.id,
    previousValue: { status: rule.from },
    newValue: {
      number: sample.number,
      status: target,
      ...(parsed.data.trackingRef ? { tracking: parsed.data.trackingRef } : {}),
    },
  });
}

export async function evaluateSample(input: unknown): Promise<void> {
  const parsed = evaluateSampleSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const sample = await loadSampleOr404(parsed.data.sampleId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingSampleManage,
    companyId: sample.company_id,
  });
  const session = await requireActiveUser();
  if (sample.status !== "received") {
    throw conflict("Only received samples can be evaluated");
  }

  const admin = createAdminSupabase();
  const { data: updated, error } = await admin
    .from("sample_requests")
    .update({
      status: "evaluated",
      evaluation_outcome: parsed.data.outcome,
      evaluation_notes: parsed.data.notes,
      evaluated_at: new Date().toISOString(),
      evaluated_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .eq("id", sample.id)
    .eq("status", "received")
    .select("id")
    .maybeSingle();
  if (error) throw internal();
  if (!updated) throw conflict("The sample was already evaluated");

  await writeAudit({
    module: "purchasing",
    action: "sample.evaluated",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: sample.company_id,
    entityType: "sample_request",
    entityId: sample.id,
    previousValue: { status: "received" },
    newValue: { number: sample.number, outcome: parsed.data.outcome },
    reason: parsed.data.notes,
  });
}

export async function cancelSample(input: unknown): Promise<void> {
  const parsed = cancelSampleSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const sample = await loadSampleOr404(parsed.data.sampleId);
  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingSampleManage,
    companyId: sample.company_id,
  });
  const session = await requireActiveUser();
  if (["evaluated", "cancelled"].includes(sample.status)) {
    throw conflict("Evaluated or cancelled samples cannot be cancelled");
  }

  const admin = createAdminSupabase();
  const { data: updated, error } = await admin
    .from("sample_requests")
    .update({
      status: "cancelled",
      cancel_reason: parsed.data.reason,
      updated_by: ctx.userId,
    })
    .eq("id", sample.id)
    .not("status", "in", "(evaluated,cancelled)")
    .select("id")
    .maybeSingle();
  if (error) throw internal();
  if (!updated) throw conflict("The sample is no longer cancellable");

  await writeAudit({
    module: "purchasing",
    action: "sample.cancelled",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: sample.company_id,
    entityType: "sample_request",
    entityId: sample.id,
    previousValue: { status: sample.status },
    newValue: { number: sample.number, status: "cancelled" },
    reason: parsed.data.reason,
  });
}
