import { z } from "zod";
import { uuidSchema } from "@/server/validation/organization";
import { reasonSchema } from "@/server/validation/products";

/**
 * Inventory validation. Quantities are whole units — you cannot move half
 * a garment — and each transaction type constrains its own sign, matching
 * the database check so a rejected posting fails at the boundary with a
 * readable message rather than as a constraint violation.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

/** Every ledger type that exists in the schema. */
export const ALL_TXN_TYPES = [
  "opening_stock",
  "purchase_receipt",
  "transfer_out",
  "transfer_in",
  "damage",
  "adjustment",
  "count_correction",
  "supplier_return",
  "sale",
  "customer_return",
  "reservation",
  "reservation_release",
] as const;

export type TxnType = (typeof ALL_TXN_TYPES)[number];

/**
 * Types a human may post directly in this phase. The others exist in the
 * schema for later phases (POS sales, order reservations) and are refused
 * here so an unimplemented flow cannot be smuggled in early.
 */
export const MANUAL_TXN_TYPES = [
  "opening_stock",
  "damage",
  "supplier_return",
] as const;

export const POSITIVE_TYPES: readonly TxnType[] = [
  "opening_stock",
  "purchase_receipt",
  "transfer_in",
  "customer_return",
  "reservation_release",
];

export const NEGATIVE_TYPES: readonly TxnType[] = [
  "transfer_out",
  "damage",
  "supplier_return",
  "sale",
  "reservation",
];

/**
 * Does this quantity have the right sign for its type? Mirrors the
 * database check constraint; `adjustment` and `count_correction` accept
 * either sign but never zero.
 */
export function signMatchesType(type: TxnType, quantity: number): boolean {
  if (quantity === 0) return false;
  if (POSITIVE_TYPES.includes(type)) return quantity > 0;
  if (NEGATIVE_TYPES.includes(type)) return quantity < 0;
  return true;
}

/** Movement quantities are entered as a magnitude; the type sets the sign. */
export const magnitudeSchema = z.coerce
  .number()
  .int("Quantity must be a whole number")
  .positive("Quantity must be greater than zero")
  .max(10_000_000, "Quantity is unrealistically large");

/** Adjustment lines carry a signed delta: +found, −lost. */
export const signedQuantitySchema = z.coerce
  .number()
  .int("Quantity must be a whole number")
  .refine((v) => v !== 0, "Quantity cannot be zero")
  .refine((v) => Math.abs(v) <= 1_000_000, "Quantity is unrealistically large");

/** Counted quantities may legitimately be zero — the shelf was empty. */
export const countedQuantitySchema = z.coerce
  .number()
  .int("Counted quantity must be a whole number")
  .min(0, "Counted quantity cannot be negative")
  .max(10_000_000, "Counted quantity is unrealistically large");

export const postMovementSchema = z.object({
  companyId: uuidSchema,
  warehouseId: uuidSchema,
  productId: uuidSchema,
  variantId: uuidSchema.optional().or(z.literal("").transform(() => undefined)),
  txnType: z.enum(MANUAL_TXN_TYPES),
  quantity: magnitudeSchema,
  reason: reasonSchema,
  allowNegative: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "true" || v === "on"),
});

export const createLocationSchema = z.object({
  warehouseId: uuidSchema,
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(30)
    .regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Code must be uppercase letters, digits, underscores or dashes"),
  name: z.string().trim().min(1, "Name is required").max(120),
});

export const createTransferSchema = z
  .object({
    companyId: uuidSchema,
    fromWarehouse: uuidSchema,
    toWarehouse: uuidSchema,
    note: optionalText(1000),
  })
  .refine((v) => v.fromWarehouse !== v.toWarehouse, {
    message: "Choose two different warehouses",
    path: ["toWarehouse"],
  });

export const addTransferLineSchema = z.object({
  transferId: uuidSchema,
  productId: uuidSchema,
  variantId: uuidSchema.optional().or(z.literal("").transform(() => undefined)),
  quantity: magnitudeSchema,
});

export const transferIdSchema = z.object({ transferId: uuidSchema });

export const cancelTransferSchema = z.object({
  transferId: uuidSchema,
  reason: reasonSchema,
});

export const receiveTransferSchema = z.object({
  transferId: uuidSchema,
  lines: z
    .array(
      z.object({
        lineId: uuidSchema,
        receivedQty: countedQuantitySchema,
      }),
    )
    .min(1, "A receipt needs at least one line"),
});

export const createAdjustmentSchema = z.object({
  companyId: uuidSchema,
  warehouseId: uuidSchema,
  reason: reasonSchema,
});

export const addAdjustmentLineSchema = z.object({
  adjustmentId: uuidSchema,
  productId: uuidSchema,
  variantId: uuidSchema.optional().or(z.literal("").transform(() => undefined)),
  quantity: signedQuantitySchema,
  note: optionalText(500),
});

export const adjustmentIdSchema = z.object({ adjustmentId: uuidSchema });

export const decideAdjustmentSchema = z.object({
  adjustmentId: uuidSchema,
  decision: z.enum(["approved", "rejected"]),
  reason: reasonSchema,
  allowNegative: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "true" || v === "on"),
});

export const openCountSchema = z.object({
  companyId: uuidSchema,
  warehouseId: uuidSchema,
  note: optionalText(1000),
});

export const countIdSchema = z.object({ countId: uuidSchema });

export const enterCountLineSchema = z.object({
  countId: uuidSchema,
  lineId: uuidSchema,
  countedQty: countedQuantitySchema,
  note: optionalText(500),
});

export const cancelCountSchema = z.object({
  countId: uuidSchema,
  reason: reasonSchema,
});

/**
 * Variance for a count line. Returns null when the line was not counted
 * or matched exactly — those produce no ledger entry at all, so a count
 * of an accurate warehouse writes nothing.
 */
export function countVariance(line: {
  system_qty: number;
  counted_qty: number | null;
}): number | null {
  if (line.counted_qty === null) return null;
  const delta = line.counted_qty - line.system_qty;
  return delta === 0 ? null : delta;
}
