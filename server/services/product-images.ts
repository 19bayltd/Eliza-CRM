import "server-only";

import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/server/auth/session";
import { PERMISSIONS, hasPermission, requirePermission } from "@/server/permissions";
import { writeAudit } from "@/server/audit";
import { conflict, internal, invalidInput, notFound } from "@/server/errors";
import { createSignedDownloadUrl, deletePrivateFile, uploadPrivateFile } from "@/server/storage";
import { uploadProductImageSchema } from "@/server/validation/products";
import { uuidSchema } from "@/server/validation/organization";
import type { Tables } from "@/types/database";

/**
 * Product image registry. Objects live in the two private product-image
 * buckets; the storage service enforces bucket permissions, size, and
 * mime limits and audits uploads/downloads. This service ties objects to
 * products/variants and enforces the tier rules.
 */

const TIER_BUCKET = {
  public: "public-product-images",
  confidential: "confidential-product-images",
} as const;

export type ProductImageEntry = Tables<"product_images"> & {
  originalName: string;
  url: string;
};

export async function addProductImage(params: {
  input: z.input<typeof uploadProductImageSchema>;
  filename: string;
  mimeType: string;
  content: ArrayBuffer;
}): Promise<void> {
  const parsed = uploadProductImageSchema.safeParse(params.input);
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
    throw conflict("Archived products cannot receive images");
  }

  if (parsed.data.variantId) {
    const { data: variant } = await admin
      .from("product_variants")
      .select("id, product_id")
      .eq("id", parsed.data.variantId)
      .maybeSingle();
    if (!variant || variant.product_id !== product.id) {
      throw invalidInput("Variant does not belong to this product");
    }
  }

  // Module gate: attaching images is a product edit. The storage service
  // additionally enforces the bucket's own upload permission (which for
  // the confidential bucket is the intelligence permission).
  const ctx = await requirePermission({
    permission: PERMISSIONS.productsUpdate,
    companyId: product.company_id,
  });
  const session = await requireActiveUser();

  const { fileId } = await uploadPrivateFile({
    bucket: TIER_BUCKET[parsed.data.tier],
    companyId: product.company_id,
    module: "products",
    filename: params.filename,
    mimeType: params.mimeType,
    content: params.content,
    entityType: "product",
    entityId: product.id,
  });

  const { error } = await admin.from("product_images").insert({
    company_id: product.company_id,
    product_id: product.id,
    variant_id: parsed.data.variantId ?? null,
    file_id: fileId,
    tier: parsed.data.tier,
    created_by: ctx.userId,
  });
  if (error) {
    await deletePrivateFile(fileId).catch(() => undefined);
    throw internal("Image could not be registered");
  }

  await writeAudit({
    module: "products",
    action: "product.image_uploaded",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: product.company_id,
    entityType: "product",
    entityId: product.id,
    newValue: { sku: product.sku, tier: parsed.data.tier, file_id: fileId },
  });
}

/**
 * Images the caller may see, with short-lived signed URLs. Confidential
 * rows are silently omitted for callers without the intelligence
 * permission (their downloads are audited by the storage service).
 */
export async function listProductImages(productId: string): Promise<ProductImageEntry[]> {
  const admin = createAdminSupabase();
  const { data: product } = await admin
    .from("products")
    .select("id, company_id")
    .eq("id", productId)
    .maybeSingle();
  if (!product) throw notFound("Product not found");
  await requirePermission({
    permission: PERMISSIONS.productsView,
    companyId: product.company_id,
  });
  const canSeeConfidential = await hasPermission({
    permission: PERMISSIONS.productsIntelligenceView,
    companyId: product.company_id,
  });

  const { data: rows, error } = await admin
    .from("product_images")
    .select("*, file_metadata!inner(original_name, status)")
    .eq("product_id", product.id)
    .eq("status", "active")
    .order("tier")
    .order("position");
  if (error) throw internal();

  const visible = (rows ?? []).filter(
    (r) => r.tier === "public" || canSeeConfidential,
  );
  const entries: ProductImageEntry[] = [];
  for (const row of visible) {
    if (row.file_metadata.status !== "active") continue;
    const url = await createSignedDownloadUrl(row.file_id);
    const { file_metadata: meta, ...image } = row;
    entries.push({ ...image, originalName: meta.original_name, url });
  }
  return entries;
}

export async function removeProductImage(imageId: string): Promise<void> {
  const parsed = uuidSchema.safeParse(imageId);
  if (!parsed.success) throw invalidInput("Invalid identifier");
  const admin = createAdminSupabase();
  const { data: image } = await admin
    .from("product_images")
    .select("*, products!inner(sku)")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!image || image.status !== "active") throw notFound("Image not found");

  const ctx = await requirePermission({
    permission: PERMISSIONS.productsUpdate,
    companyId: image.company_id,
  });
  const session = await requireActiveUser();

  // Storage delete enforces the bucket's upload permission and audits.
  await deletePrivateFile(image.file_id);

  const { error } = await admin
    .from("product_images")
    .update({ status: "deleted" })
    .eq("id", image.id);
  if (error) throw internal();

  await writeAudit({
    module: "products",
    action: "product.image_removed",
    actorUserId: ctx.userId,
    actorEmail: session.email,
    companyId: image.company_id,
    entityType: "product",
    entityId: image.product_id,
    previousValue: { sku: image.products.sku, tier: image.tier, file_id: image.file_id },
  });
}
