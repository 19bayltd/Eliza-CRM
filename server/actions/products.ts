"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/errors";
import {
  archiveCatalogEntity,
  createAttribute,
  createAttributeValue,
  createCategory,
  createUnit,
} from "@/server/services/catalog";
import {
  createProduct,
  createVariant,
  setProductStatus,
  setVariantStatus,
  updateProduct,
  upsertIntelligence,
} from "@/server/services/products";
import {
  addProductImage,
  removeProductImage,
} from "@/server/services/product-images";
import {
  applyImport,
  discardImport,
  validateImport,
} from "@/server/services/product-import";

const PRODUCTS_PATH = "/products";
const CATALOG_PATH = "/products/catalog";
const IMPORT_PATH = "/products/import";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}
function opt(formData: FormData, key: string): string | undefined {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? undefined : value;
}

export async function createUnitAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createUnit({
      companyId: str(formData, "companyId"),
      code: str(formData, "code"),
      name: str(formData, "name"),
    });
    revalidatePath(CATALOG_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function createCategoryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createCategory({
      companyId: str(formData, "companyId"),
      code: str(formData, "code"),
      name: str(formData, "name"),
      parentId: opt(formData, "parentId"),
    });
    revalidatePath(CATALOG_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function createAttributeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createAttribute({
      companyId: str(formData, "companyId"),
      code: str(formData, "code"),
      name: str(formData, "name"),
    });
    revalidatePath(CATALOG_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function createAttributeValueAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createAttributeValue({
      attributeId: str(formData, "attributeId"),
      value: str(formData, "value"),
    });
    revalidatePath(CATALOG_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function archiveCatalogAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const kind = str(formData, "kind");
    if (!["unit", "category", "attribute"].includes(kind)) {
      return { ok: false, code: "invalid_input", message: "Invalid entity" };
    }
    await archiveCatalogEntity(kind as "unit" | "category" | "attribute", {
      id: str(formData, "id"),
      reason: str(formData, "reason"),
    });
    revalidatePath(CATALOG_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function createProductAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createProduct({
      companyId: str(formData, "companyId"),
      sku: str(formData, "sku"),
      name: str(formData, "name"),
      description: opt(formData, "description"),
      categoryId: opt(formData, "categoryId"),
      unitId: opt(formData, "unitId"),
    });
    revalidatePath(PRODUCTS_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateProductAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const productId = str(formData, "productId");
    await updateProduct({
      productId,
      name: str(formData, "name"),
      description: opt(formData, "description"),
      categoryId: opt(formData, "categoryId"),
      unitId: opt(formData, "unitId"),
    });
    revalidatePath(`${PRODUCTS_PATH}/${productId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setProductStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const productId = str(formData, "productId");
    const status = str(formData, "status");
    if (status !== "active" && status !== "archived") {
      return { ok: false, code: "invalid_input", message: "Invalid status" };
    }
    await setProductStatus({
      productId,
      status,
      reason: str(formData, "reason"),
    });
    revalidatePath(PRODUCTS_PATH);
    revalidatePath(`${PRODUCTS_PATH}/${productId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function createVariantAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const productId = str(formData, "productId");
    await createVariant({
      productId,
      sku: str(formData, "sku"),
      attributeValueIds: formData
        .getAll("attributeValueIds")
        .map(String)
        .filter((v) => v !== ""),
    });
    revalidatePath(`${PRODUCTS_PATH}/${productId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setVariantStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const productId = str(formData, "productId");
    const status = str(formData, "status");
    if (status !== "active" && status !== "archived") {
      return { ok: false, code: "invalid_input", message: "Invalid status" };
    }
    await setVariantStatus({
      variantId: str(formData, "variantId"),
      status,
      reason: str(formData, "reason"),
    });
    revalidatePath(`${PRODUCTS_PATH}/${productId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function upsertIntelligenceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const productId = str(formData, "productId");
    await upsertIntelligence({
      productId,
      sourcingNotes: opt(formData, "sourcingNotes"),
      targetCost: str(formData, "targetCost"),
      targetCostCurrency: str(formData, "targetCostCurrency"),
      remarks: opt(formData, "remarks"),
    });
    revalidatePath(`${PRODUCTS_PATH}/${productId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function uploadProductImageAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const productId = str(formData, "productId");
    const tier = str(formData, "tier");
    if (tier !== "public" && tier !== "confidential") {
      return { ok: false, code: "invalid_input", message: "Invalid image tier" };
    }
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, code: "invalid_input", message: "Choose an image file" };
    }
    await addProductImage({
      input: { productId, variantId: opt(formData, "variantId"), tier },
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      content: await file.arrayBuffer(),
    });
    revalidatePath(`${PRODUCTS_PATH}/${productId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function removeProductImageAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const productId = str(formData, "productId");
    await removeProductImage(str(formData, "imageId"));
    revalidatePath(`${PRODUCTS_PATH}/${productId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function importValidateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, code: "invalid_input", message: "Choose a CSV file" };
    }
    await validateImport({
      companyId: str(formData, "companyId"),
      filename: file.name,
      csv: await file.text(),
    });
    revalidatePath(IMPORT_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function importApplyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await applyImport({ jobId: str(formData, "jobId") });
    revalidatePath(IMPORT_PATH);
    revalidatePath(PRODUCTS_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function importDiscardAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await discardImport({ jobId: str(formData, "jobId") });
    revalidatePath(IMPORT_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
