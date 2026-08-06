"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/errors";
import {
  addContact,
  archiveContact,
  archiveSupplier,
  createSupplier,
  updateSupplier,
} from "@/server/services/suppliers";
import { archiveQuotation, createQuotation } from "@/server/services/quotations";
import {
  addSupplierDocument,
  removeSupplierDocument,
} from "@/server/services/supplier-documents";

const SUPPLIERS_PATH = "/suppliers";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}
function opt(formData: FormData, key: string): string | undefined {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? undefined : value;
}

export async function createSupplierAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createSupplier({
      companyId: str(formData, "companyId"),
      code: str(formData, "code"),
      name: str(formData, "name"),
      country: str(formData, "country"),
      address: opt(formData, "address"),
      capabilities: opt(formData, "capabilities"),
      notes: opt(formData, "notes"),
    });
    revalidatePath(SUPPLIERS_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateSupplierAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const supplierId = str(formData, "supplierId");
    await updateSupplier({
      supplierId,
      name: str(formData, "name"),
      country: str(formData, "country"),
      address: opt(formData, "address"),
      capabilities: opt(formData, "capabilities"),
      notes: opt(formData, "notes"),
    });
    revalidatePath(`${SUPPLIERS_PATH}/${supplierId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function archiveSupplierAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await archiveSupplier({
      id: str(formData, "id"),
      reason: str(formData, "reason"),
    });
    revalidatePath(SUPPLIERS_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function addContactAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const supplierId = str(formData, "supplierId");
    await addContact({
      supplierId,
      name: str(formData, "name"),
      roleTitle: opt(formData, "roleTitle"),
      phone: opt(formData, "phone"),
      messaging: opt(formData, "messaging"),
      email: str(formData, "email"),
    });
    revalidatePath(`${SUPPLIERS_PATH}/${supplierId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function archiveContactAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const supplierId = str(formData, "supplierId");
    await archiveContact({
      id: str(formData, "id"),
      reason: str(formData, "reason"),
    });
    revalidatePath(`${SUPPLIERS_PATH}/${supplierId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function createQuotationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const supplierId = str(formData, "supplierId");
    await createQuotation({
      supplierId,
      productId: str(formData, "productId"),
      variantId: opt(formData, "variantId"),
      unitPrice: str(formData, "unitPrice"),
      currency: str(formData, "currency"),
      exchangeRate: str(formData, "exchangeRate"),
      moq: opt(formData, "moq"),
      leadTimeDays: opt(formData, "leadTimeDays"),
      validUntil: str(formData, "validUntil"),
      terms: opt(formData, "terms"),
    });
    revalidatePath(`${SUPPLIERS_PATH}/${supplierId}`);
    revalidatePath(`${SUPPLIERS_PATH}/compare`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function archiveQuotationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const supplierId = str(formData, "supplierId");
    await archiveQuotation({
      id: str(formData, "id"),
      reason: str(formData, "reason"),
    });
    revalidatePath(`${SUPPLIERS_PATH}/${supplierId}`);
    revalidatePath(`${SUPPLIERS_PATH}/compare`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function uploadSupplierDocumentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const supplierId = str(formData, "supplierId");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, code: "invalid_input", message: "Choose a file" };
    }
    await addSupplierDocument({
      input: { supplierId, title: opt(formData, "title") },
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      content: await file.arrayBuffer(),
    });
    revalidatePath(`${SUPPLIERS_PATH}/${supplierId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function removeSupplierDocumentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const supplierId = str(formData, "supplierId");
    await removeSupplierDocument(str(formData, "documentId"));
    revalidatePath(`${SUPPLIERS_PATH}/${supplierId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
