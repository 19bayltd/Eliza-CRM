import "server-only";

import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/server/auth/session";
import { PERMISSIONS, requirePermission } from "@/server/permissions";
import { writeAudit } from "@/server/audit";
import { internal, invalidInput, notFound, conflict } from "@/server/errors";
import {
  createSignedDownloadUrl,
  deletePrivateFile,
  uploadPrivateFile,
} from "@/server/storage";
import { uploadSupplierDocumentSchema } from "@/server/validation/suppliers";
import { uuidSchema } from "@/server/validation/organization";
import type { Tables } from "@/types/database";

/**
 * Private supplier documents (contracts, price lists, certificates).
 * Objects live in the confidential supplier-documents bucket; the storage
 * service enforces bucket permissions and audits every download.
 */

export type SupplierDocumentEntry = Tables<"supplier_documents"> & {
  originalName: string;
  url: string;
};

export async function addSupplierDocument(params: {
  input: z.input<typeof uploadSupplierDocumentSchema>;
  filename: string;
  mimeType: string;
  content: ArrayBuffer;
}): Promise<void> {
  const parsed = uploadSupplierDocumentSchema.safeParse(params.input);
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
    throw conflict("Archived suppliers cannot receive documents");
  }

  const ctx = await requirePermission({
    permission: PERMISSIONS.suppliersDocumentManage,
    companyId: supplier.company_id,
  });
  const session = await requireActiveUser();

  const { fileId } = await uploadPrivateFile({
    bucket: "supplier-documents",
    companyId: supplier.company_id,
    module: "suppliers",
    filename: params.filename,
    mimeType: params.mimeType,
    content: params.content,
    entityType: "supplier",
    entityId: supplier.id,
  });

  const { error } = await admin.from("supplier_documents").insert({
    company_id: supplier.company_id,
    supplier_id: supplier.id,
    file_id: fileId,
    title: parsed.data.title ?? null,
    created_by: ctx.userId,
  });
  if (error) {
    await deletePrivateFile(fileId).catch(() => undefined);
    throw internal("Document could not be registered");
  }

  await writeAudit({
    module: "suppliers",
    action: "supplier.document_uploaded",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: supplier.company_id,
    entityType: "supplier",
    entityId: supplier.id,
    newValue: { supplier: supplier.code, title: parsed.data.title ?? params.filename },
  });
}

/** Documents with short-lived signed URLs; downloads audited by storage. */
export async function listSupplierDocuments(
  supplierId: string,
): Promise<SupplierDocumentEntry[]> {
  const admin = createAdminSupabase();
  const { data: supplier } = await admin
    .from("suppliers")
    .select("id, company_id")
    .eq("id", supplierId)
    .maybeSingle();
  if (!supplier) throw notFound("Supplier not found");
  await requirePermission({
    permission: PERMISSIONS.suppliersDocumentDownload,
    companyId: supplier.company_id,
  });

  const { data: rows, error } = await admin
    .from("supplier_documents")
    .select("*, file_metadata!inner(original_name, status)")
    .eq("supplier_id", supplier.id)
    .eq("status", "active")
    .order("created_at");
  if (error) throw internal();

  const entries: SupplierDocumentEntry[] = [];
  for (const row of rows ?? []) {
    if (row.file_metadata.status !== "active") continue;
    const url = await createSignedDownloadUrl(row.file_id);
    const { file_metadata: meta, ...doc } = row;
    entries.push({ ...doc, originalName: meta.original_name, url });
  }
  return entries;
}

export async function removeSupplierDocument(documentId: string): Promise<void> {
  const parsed = uuidSchema.safeParse(documentId);
  if (!parsed.success) throw invalidInput("Invalid identifier");
  const admin = createAdminSupabase();
  const { data: doc } = await admin
    .from("supplier_documents")
    .select("*, suppliers!inner(code)")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!doc || doc.status !== "active") throw notFound("Document not found");

  const ctx = await requirePermission({
    permission: PERMISSIONS.suppliersDocumentManage,
    companyId: doc.company_id,
  });
  const session = await requireActiveUser();

  // Registry first, object second: the old order could leave a permanently
  // irremovable active row when the object delete succeeded but the row
  // update failed (review finding). If the object delete fails, the row
  // is restored so the operation stays retryable.
  const { error } = await admin
    .from("supplier_documents")
    .update({ status: "deleted" })
    .eq("id", doc.id);
  if (error) throw internal();
  try {
    await deletePrivateFile(doc.file_id);
  } catch (err) {
    await admin
      .from("supplier_documents")
      .update({ status: "active" })
      .eq("id", doc.id);
    throw err;
  }

  await writeAudit({
    module: "suppliers",
    action: "supplier.document_removed",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: doc.company_id,
    entityType: "supplier",
    entityId: doc.supplier_id,
    previousValue: { supplier: doc.suppliers.code, title: doc.title, file_id: doc.file_id },
  });
}
