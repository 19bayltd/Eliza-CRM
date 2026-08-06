import "server-only";

import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/server/auth/session";
import { PERMISSIONS, requirePermission } from "@/server/permissions";
import { writeAudit } from "@/server/audit";
import { conflict, internal, invalidInput, notFound } from "@/server/errors";
import {
  createSignedDownloadUrl,
  deletePrivateFile,
  uploadPrivateFile,
} from "@/server/storage";
import { uuidSchema } from "@/server/validation/organization";
import type { Tables } from "@/types/database";

/**
 * Paperwork attached to purchase orders and sample requests. Purchase
 * documents are confidential; sample photos are internal. Both flow
 * through the storage service, so every download is audited.
 */

export type PurchaseDocumentEntry = Tables<"purchase_documents"> & {
  originalName: string;
  url: string;
};

const attachSchema = z.object({
  entityType: z.enum(["purchase_order", "sample_request"]),
  entityId: uuidSchema,
  title: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

/** Resolve the parent and its company, refusing closed-out parents. */
async function loadEntity(entityType: string, entityId: string) {
  const admin = createAdminSupabase();
  if (entityType === "purchase_order") {
    const { data } = await admin
      .from("purchase_orders")
      .select("id, company_id, number, status")
      .eq("id", entityId)
      .maybeSingle();
    if (!data) throw notFound("Purchase order not found");
    return { companyId: data.company_id, number: data.number, status: data.status };
  }
  const { data } = await admin
    .from("sample_requests")
    .select("id, company_id, number, status")
    .eq("id", entityId)
    .maybeSingle();
  if (!data) throw notFound("Sample request not found");
  return { companyId: data.company_id, number: data.number, status: data.status };
}

export async function addPurchaseDocument(params: {
  input: z.input<typeof attachSchema>;
  filename: string;
  mimeType: string;
  content: ArrayBuffer;
}): Promise<void> {
  const parsed = attachSchema.safeParse(params.input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const entity = await loadEntity(parsed.data.entityType, parsed.data.entityId);
  if (entity.status === "cancelled") {
    throw conflict("Cancelled records cannot receive documents");
  }

  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingDocumentManage,
    companyId: entity.companyId,
  });
  const session = await requireActiveUser();

  const bucket =
    parsed.data.entityType === "sample_request" ? "sample-photos" : "purchase-documents";

  const { fileId } = await uploadPrivateFile({
    bucket,
    companyId: entity.companyId,
    module: "purchasing",
    filename: params.filename,
    mimeType: params.mimeType,
    content: params.content,
    entityType: parsed.data.entityType,
    entityId: parsed.data.entityId,
  });

  const admin = createAdminSupabase();
  const { error } = await admin.from("purchase_documents").insert({
    company_id: entity.companyId,
    entity_type: parsed.data.entityType,
    entity_id: parsed.data.entityId,
    file_id: fileId,
    title: parsed.data.title ?? null,
    created_by: ctx.userId,
  });
  if (error) {
    await deletePrivateFile(fileId).catch(() => undefined);
    throw internal("Document could not be registered");
  }

  await writeAudit({
    module: "purchasing",
    action: "purchase.document_uploaded",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: entity.companyId,
    entityType: parsed.data.entityType,
    entityId: parsed.data.entityId,
    newValue: { number: entity.number, title: parsed.data.title ?? params.filename },
  });
}

export async function listPurchaseDocuments(
  entityType: "purchase_order" | "sample_request",
  entityId: string,
): Promise<PurchaseDocumentEntry[]> {
  const entity = await loadEntity(entityType, entityId);
  await requirePermission({
    permission: PERMISSIONS.purchasingDocumentDownload,
    companyId: entity.companyId,
  });

  const admin = createAdminSupabase();
  const { data: rows, error } = await admin
    .from("purchase_documents")
    .select("*, file_metadata!purchase_documents_file_id_fkey!inner(original_name, status)")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("status", "active")
    .order("created_at");
  if (error) throw internal();

  const entries: PurchaseDocumentEntry[] = [];
  for (const row of rows ?? []) {
    if (row.file_metadata.status !== "active") continue;
    const url = await createSignedDownloadUrl(row.file_id);
    const { file_metadata: meta, ...doc } = row;
    entries.push({ ...doc, originalName: meta.original_name, url });
  }
  return entries;
}

export async function removePurchaseDocument(documentId: string): Promise<void> {
  const parsed = uuidSchema.safeParse(documentId);
  if (!parsed.success) throw invalidInput("Invalid identifier");
  const admin = createAdminSupabase();
  const { data: doc } = await admin
    .from("purchase_documents")
    .select("*")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!doc || doc.status !== "active") throw notFound("Document not found");

  const ctx = await requirePermission({
    permission: PERMISSIONS.purchasingDocumentManage,
    companyId: doc.company_id,
  });
  const session = await requireActiveUser();

  // Registry first, object second, with restore on failure: the reverse
  // order can strand a permanently irremovable active row (Phase 03
  // review finding 10, applied here from the start).
  const { error } = await admin
    .from("purchase_documents")
    .update({ status: "deleted" })
    .eq("id", doc.id);
  if (error) throw internal();
  try {
    await deletePrivateFile(doc.file_id);
  } catch (err) {
    await admin
      .from("purchase_documents")
      .update({ status: "active" })
      .eq("id", doc.id);
    throw err;
  }

  await writeAudit({
    module: "purchasing",
    action: "purchase.document_removed",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: doc.company_id,
    entityType: doc.entity_type,
    entityId: doc.entity_id,
    previousValue: { title: doc.title, file_id: doc.file_id },
  });
}
