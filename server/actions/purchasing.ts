"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/errors";
import {
  addRequestLine,
  cancelRequest,
  createRequest,
  decideRequest,
  submitRequest,
  updateRequest,
} from "@/server/services/purchase-requests";
import {
  addOrderLine,
  cancelOrder,
  createOrder,
  issueOrder,
  recordReceipt,
} from "@/server/services/purchase-orders";
import {
  addPurchaseDocument,
  removePurchaseDocument,
} from "@/server/services/purchase-documents";
import {
  advanceSample,
  cancelSample,
  createSample,
  evaluateSample,
} from "@/server/services/samples";

const PURCHASING_PATH = "/purchasing";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}
function opt(formData: FormData, key: string): string | undefined {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? undefined : value;
}

function revalidateAll(): void {
  revalidatePath(PURCHASING_PATH);
  revalidatePath(`${PURCHASING_PATH}/orders`);
  revalidatePath(`${PURCHASING_PATH}/samples`);
}

/* ------------------------------- requests ------------------------------- */

export async function createRequestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createRequest({
      companyId: str(formData, "companyId"),
      title: str(formData, "title"),
      justification: opt(formData, "justification"),
      neededBy: opt(formData, "neededBy"),
    });
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateRequestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await updateRequest({
      requestId: str(formData, "requestId"),
      title: str(formData, "title"),
      justification: opt(formData, "justification"),
      neededBy: opt(formData, "neededBy"),
    });
    revalidateAll();
    revalidatePath(`${PURCHASING_PATH}/requests/${str(formData, "requestId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function addRequestLineAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await addRequestLine({
      requestId: str(formData, "requestId"),
      productId: str(formData, "productId"),
      variantId: opt(formData, "variantId"),
      quantity: str(formData, "quantity"),
      estimatedUnitPrice: str(formData, "estimatedUnitPrice"),
      notes: opt(formData, "notes"),
    });
    revalidatePath(`${PURCHASING_PATH}/requests/${str(formData, "requestId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function submitRequestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await submitRequest({ requestId: str(formData, "requestId") });
    revalidateAll();
    revalidatePath(`${PURCHASING_PATH}/requests/${str(formData, "requestId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function decideRequestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await decideRequest({
      requestId: str(formData, "requestId"),
      decision: str(formData, "decision"),
      reason: str(formData, "reason"),
    });
    revalidateAll();
    revalidatePath(`${PURCHASING_PATH}/requests/${str(formData, "requestId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function cancelRequestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await cancelRequest({
      requestId: str(formData, "requestId"),
      reason: str(formData, "reason"),
    });
    revalidateAll();
    revalidatePath(`${PURCHASING_PATH}/requests/${str(formData, "requestId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

/* -------------------------------- orders -------------------------------- */

export async function createOrderAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createOrder({
      companyId: str(formData, "companyId"),
      supplierId: str(formData, "supplierId"),
      requestId: opt(formData, "requestId"),
      currency: str(formData, "currency"),
      exchangeRate: str(formData, "exchangeRate"),
      expectedDate: opt(formData, "expectedDate"),
      terms: opt(formData, "terms"),
    });
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function addOrderLineAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await addOrderLine({
      orderId: str(formData, "orderId"),
      productId: str(formData, "productId"),
      variantId: opt(formData, "variantId"),
      quantity: str(formData, "quantity"),
      unitPrice: str(formData, "unitPrice"),
      notes: opt(formData, "notes"),
    });
    revalidatePath(`${PURCHASING_PATH}/orders/${str(formData, "orderId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function issueOrderAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await issueOrder({ orderId: str(formData, "orderId") });
    revalidateAll();
    revalidatePath(`${PURCHASING_PATH}/orders/${str(formData, "orderId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function cancelOrderAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await cancelOrder({
      orderId: str(formData, "orderId"),
      reason: str(formData, "reason"),
    });
    revalidateAll();
    revalidatePath(`${PURCHASING_PATH}/orders/${str(formData, "orderId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Receiving posts every line at once: the form carries one row per order
 * line, and the service hands the whole set to a single transaction.
 */
export async function recordReceiptAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const orderId = str(formData, "orderId");
    const lineIds = formData.getAll("lineId").map(String);
    const lines = lineIds.map((lineId) => ({
      orderLineId: lineId,
      acceptedQty: str(formData, `accepted_${lineId}`) || "0",
      damagedQty: str(formData, `damaged_${lineId}`) || "0",
      missingQty: str(formData, `missing_${lineId}`) || "0",
      extraQty: str(formData, `extra_${lineId}`) || "0",
      note: opt(formData, `note_${lineId}`),
    }));
    await recordReceipt({ orderId, note: opt(formData, "note"), lines });
    revalidateAll();
    revalidatePath(`${PURCHASING_PATH}/orders/${orderId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

/* -------------------------------- samples ------------------------------- */

export async function createSampleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createSample({
      companyId: str(formData, "companyId"),
      supplierId: str(formData, "supplierId"),
      productId: opt(formData, "productId"),
      variantId: opt(formData, "variantId"),
      description: str(formData, "description"),
      quantity: str(formData, "quantity"),
      purpose: opt(formData, "purpose"),
    });
    revalidatePath(`${PURCHASING_PATH}/samples`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function dispatchSampleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await advanceSample("dispatched", {
      sampleId: str(formData, "sampleId"),
      trackingRef: opt(formData, "trackingRef"),
    });
    revalidatePath(`${PURCHASING_PATH}/samples`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function receiveSampleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await advanceSample("received", { sampleId: str(formData, "sampleId") });
    revalidatePath(`${PURCHASING_PATH}/samples`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function evaluateSampleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await evaluateSample({
      sampleId: str(formData, "sampleId"),
      outcome: str(formData, "outcome"),
      notes: str(formData, "notes"),
    });
    revalidatePath(`${PURCHASING_PATH}/samples`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function cancelSampleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await cancelSample({
      sampleId: str(formData, "sampleId"),
      reason: str(formData, "reason"),
    });
    revalidatePath(`${PURCHASING_PATH}/samples`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

/* ------------------------------- documents ------------------------------ */

export async function uploadPurchaseDocumentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const entityType = str(formData, "entityType") as
      | "purchase_order"
      | "sample_request";
    const entityId = str(formData, "entityId");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, code: "invalid_input", message: "Choose a file" };
    }
    await addPurchaseDocument({
      input: { entityType, entityId, title: opt(formData, "title") },
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      content: await file.arrayBuffer(),
    });
    revalidatePath(
      entityType === "sample_request"
        ? `${PURCHASING_PATH}/samples`
        : `${PURCHASING_PATH}/orders/${entityId}`,
    );
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function removePurchaseDocumentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await removePurchaseDocument(str(formData, "documentId"));
    revalidateAll();
    revalidatePath(`${PURCHASING_PATH}/orders/${str(formData, "orderId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
