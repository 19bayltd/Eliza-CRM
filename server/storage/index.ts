import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/server/auth/session";
import { PERMISSIONS, requirePermission } from "@/server/permissions";
import { forbidden, internal, invalidInput, notFound } from "@/server/errors";
import { writeAudit } from "@/server/audit";

/**
 * Private storage service (docs/FILE_STORAGE_POLICY.md). All object access
 * goes through here: buckets have no client policies, so the browser can
 * never read or write objects directly. Signed URLs are short-lived and
 * every sensitive access is audited.
 */

const BUCKETS = {
  "system-exports": {
    classification: "confidential",
    maxSizeBytes: 50 * 1024 * 1024,
    allowedMimePrefixes: ["text/csv", "application/json", "application/pdf"],
    signedUrlSeconds: 300,
  },
} as const;

type BucketId = keyof typeof BUCKETS;

function assertBucket(bucket: string): BucketId {
  if (!(bucket in BUCKETS)) throw invalidInput("Unknown storage bucket");
  return bucket as BucketId;
}

/** Object paths always embed company scope: <companyId>/<module>/<name>. */
function buildPath(companyId: string, moduleName: string, filename: string): string {
  const safeModule = moduleName.replace(/[^a-z0-9_-]/gi, "");
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  if (!safeModule || !safeName) throw invalidInput("Invalid file name");
  return `${companyId}/${safeModule}/${crypto.randomUUID()}_${safeName}`;
}

export async function uploadPrivateFile(params: {
  bucket: string;
  companyId: string;
  module: string;
  filename: string;
  mimeType: string;
  content: ArrayBuffer | Uint8Array;
  entityType?: string;
  entityId?: string;
}): Promise<{ fileId: string; path: string }> {
  const bucket = assertBucket(params.bucket);
  const cfg = BUCKETS[bucket];
  const session = await requireActiveUser();
  await requirePermission({
    permission: PERMISSIONS.fileUpload,
    companyId: params.companyId,
  });

  const size = params.content.byteLength;
  if (size === 0) throw invalidInput("File is empty");
  if (size > cfg.maxSizeBytes) throw invalidInput("File is too large");
  if (!cfg.allowedMimePrefixes.some((p) => params.mimeType.startsWith(p))) {
    throw invalidInput("File type is not allowed in this bucket");
  }

  const path = buildPath(params.companyId, params.module, params.filename);
  const admin = createAdminSupabase();

  const { error: uploadError } = await admin.storage
    .from(bucket)
    .upload(path, params.content, { contentType: params.mimeType });
  if (uploadError) throw internal("Upload failed");

  const { data: meta, error: metaError } = await admin
    .from("file_metadata")
    .insert({
      bucket,
      path,
      company_id: params.companyId,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      classification: cfg.classification,
      size_bytes: size,
      mime_type: params.mimeType,
      original_name: params.filename,
      uploaded_by: session.userId,
    })
    .select("id")
    .single();
  if (metaError) {
    // Keep storage and metadata consistent.
    await admin.storage.from(bucket).remove([path]);
    throw internal("Upload could not be recorded");
  }

  await writeAudit({
    module: "storage",
    action: "file.uploaded",
    actorUserId: session.userId,
    actorEmail: session.email,
    companyId: params.companyId,
    entityType: "file",
    entityId: meta.id,
    newValue: {
      bucket,
      original_name: params.filename,
      mime_type: params.mimeType,
      size_bytes: size,
    },
  });
  return { fileId: meta.id, path };
}

/** Short-lived signed URL; access is permission-checked and audited. */
export async function createSignedDownloadUrl(fileId: string): Promise<string> {
  const session = await requireActiveUser();
  const admin = createAdminSupabase();

  const { data: meta } = await admin
    .from("file_metadata")
    .select("*")
    .eq("id", fileId)
    .maybeSingle();
  if (!meta || meta.status !== "active") throw notFound("File not found");

  const bucket = assertBucket(meta.bucket);
  await requirePermission({
    permission: PERMISSIONS.fileDownload,
    companyId: meta.company_id,
  });

  // Defense in depth: the object path must belong to the metadata company.
  if (!meta.path.startsWith(`${meta.company_id}/`)) {
    throw forbidden("File scope mismatch");
  }

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(meta.path, BUCKETS[bucket].signedUrlSeconds);
  if (error || !data) throw internal("Could not create download link");

  await writeAudit({
    module: "storage",
    action: "file.downloaded",
    actorUserId: session.userId,
    actorEmail: session.email,
    companyId: meta.company_id,
    entityType: "file",
    entityId: meta.id,
    newValue: { bucket: meta.bucket, original_name: meta.original_name },
  });
  return data.signedUrl;
}

/** Soft delete: metadata status change + object removal, audited. */
export async function deletePrivateFile(fileId: string): Promise<void> {
  const session = await requireActiveUser();
  const admin = createAdminSupabase();

  const { data: meta } = await admin
    .from("file_metadata")
    .select("*")
    .eq("id", fileId)
    .maybeSingle();
  if (!meta || meta.status !== "active") throw notFound("File not found");

  const bucket = assertBucket(meta.bucket);
  await requirePermission({
    permission: PERMISSIONS.fileUpload,
    companyId: meta.company_id,
  });

  const { error: removeError } = await admin.storage
    .from(bucket)
    .remove([meta.path]);
  if (removeError) throw internal("Delete failed");

  const { error: metaError } = await admin
    .from("file_metadata")
    .update({ status: "deleted" })
    .eq("id", fileId);
  if (metaError) throw internal("Delete could not be recorded");

  await writeAudit({
    module: "storage",
    action: "file.deleted",
    actorUserId: session.userId,
    actorEmail: session.email,
    companyId: meta.company_id,
    entityType: "file",
    entityId: meta.id,
    previousValue: { bucket: meta.bucket, original_name: meta.original_name },
  });
}
