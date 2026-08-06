"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/errors";
import { createLocation, postMovement } from "@/server/services/inventory";
import {
  addTransferLine,
  cancelTransfer,
  createTransfer,
  dispatchTransfer,
  receiveTransfer,
} from "@/server/services/stock-transfers";
import {
  addAdjustmentLine,
  createAdjustment,
  decideAdjustment,
  submitAdjustment,
} from "@/server/services/stock-adjustments";
import {
  cancelCount,
  enterCountLine,
  openCount,
  postCount,
} from "@/server/services/stock-counts";

const INVENTORY_PATH = "/inventory";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}
function opt(formData: FormData, key: string): string | undefined {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? undefined : value;
}
function revalidateAll(): void {
  revalidatePath(INVENTORY_PATH);
  revalidatePath(`${INVENTORY_PATH}/ledger`);
  revalidatePath(`${INVENTORY_PATH}/transfers`);
  revalidatePath(`${INVENTORY_PATH}/adjustments`);
  revalidatePath(`${INVENTORY_PATH}/counts`);
}

/* ------------------------------ movements ------------------------------ */

export async function postMovementAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await postMovement({
      companyId: str(formData, "companyId"),
      warehouseId: str(formData, "warehouseId"),
      productId: str(formData, "productId"),
      variantId: opt(formData, "variantId"),
      txnType: str(formData, "txnType"),
      quantity: str(formData, "quantity"),
      reason: str(formData, "reason"),
      allowNegative: formData.get("allowNegative") === "on",
    });
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function createLocationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createLocation({
      warehouseId: str(formData, "warehouseId"),
      code: str(formData, "code"),
      name: str(formData, "name"),
    });
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

/* ------------------------------ transfers ------------------------------ */

export async function createTransferAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createTransfer({
      companyId: str(formData, "companyId"),
      fromWarehouse: str(formData, "fromWarehouse"),
      toWarehouse: str(formData, "toWarehouse"),
      note: opt(formData, "note"),
    });
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function addTransferLineAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await addTransferLine({
      transferId: str(formData, "transferId"),
      productId: str(formData, "productId"),
      variantId: opt(formData, "variantId"),
      quantity: str(formData, "quantity"),
    });
    revalidatePath(`${INVENTORY_PATH}/transfers/${str(formData, "transferId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function dispatchTransferAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await dispatchTransfer({ transferId: str(formData, "transferId") });
    revalidateAll();
    revalidatePath(`${INVENTORY_PATH}/transfers/${str(formData, "transferId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function receiveTransferAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const transferId = str(formData, "transferId");
    const lineIds = formData.getAll("lineId").map(String);
    await receiveTransfer({
      transferId,
      lines: lineIds.map((lineId) => ({
        lineId,
        receivedQty: str(formData, `received_${lineId}`) || "0",
      })),
    });
    revalidateAll();
    revalidatePath(`${INVENTORY_PATH}/transfers/${transferId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function cancelTransferAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await cancelTransfer({
      transferId: str(formData, "transferId"),
      reason: str(formData, "reason"),
    });
    revalidateAll();
    revalidatePath(`${INVENTORY_PATH}/transfers/${str(formData, "transferId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

/* ----------------------------- adjustments ----------------------------- */

export async function createAdjustmentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createAdjustment({
      companyId: str(formData, "companyId"),
      warehouseId: str(formData, "warehouseId"),
      reason: str(formData, "reason"),
    });
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function addAdjustmentLineAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await addAdjustmentLine({
      adjustmentId: str(formData, "adjustmentId"),
      productId: str(formData, "productId"),
      variantId: opt(formData, "variantId"),
      quantity: str(formData, "quantity"),
      note: opt(formData, "note"),
    });
    revalidatePath(`${INVENTORY_PATH}/adjustments/${str(formData, "adjustmentId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function submitAdjustmentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await submitAdjustment({ adjustmentId: str(formData, "adjustmentId") });
    revalidateAll();
    revalidatePath(`${INVENTORY_PATH}/adjustments/${str(formData, "adjustmentId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function decideAdjustmentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await decideAdjustment({
      adjustmentId: str(formData, "adjustmentId"),
      decision: str(formData, "decision"),
      reason: str(formData, "reason"),
      allowNegative: formData.get("allowNegative") === "on",
    });
    revalidateAll();
    revalidatePath(`${INVENTORY_PATH}/adjustments/${str(formData, "adjustmentId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

/* -------------------------------- counts ------------------------------- */

export async function openCountAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await openCount({
      companyId: str(formData, "companyId"),
      warehouseId: str(formData, "warehouseId"),
      note: opt(formData, "note"),
    });
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function enterCountLineAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await enterCountLine({
      countId: str(formData, "countId"),
      lineId: str(formData, "lineId"),
      countedQty: str(formData, "countedQty"),
      note: opt(formData, "note"),
    });
    revalidatePath(`${INVENTORY_PATH}/counts/${str(formData, "countId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function postCountAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await postCount({ countId: str(formData, "countId") });
    revalidateAll();
    revalidatePath(`${INVENTORY_PATH}/counts/${str(formData, "countId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function cancelCountAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await cancelCount({
      countId: str(formData, "countId"),
      reason: str(formData, "reason"),
    });
    revalidateAll();
    revalidatePath(`${INVENTORY_PATH}/counts/${str(formData, "countId")}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
