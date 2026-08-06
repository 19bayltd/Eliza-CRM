import { z } from "zod";
import { uuidSchema } from "@/server/validation/organization";
import { reasonSchema } from "@/server/validation/products";
import { exchangeRateSchema } from "@/server/validation/suppliers";

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code");

/**
 * Purchasing validation. Money crosses this boundary as decimal strings
 * and is summed with exact integer arithmetic — quantities multiply
 * prices here, so a floating-point cent error would compound per line.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

/** Whole units only: you cannot order a third of a garment. */
export const quantitySchema = z.coerce
  .number()
  .int("Quantity must be a whole number")
  .positive("Quantity must be greater than zero")
  .max(1_000_000, "Quantity is unrealistically large");

/** Received quantities may legitimately be zero (nothing damaged). */
export const receivedQuantitySchema = z.coerce
  .number()
  .int("Quantity must be a whole number")
  .min(0, "Quantity cannot be negative")
  .max(1_000_000, "Quantity is unrealistically large");

/** Money as a decimal string, at most 4 dp — never a float. */
const decimalString = (label: string, allowZero: boolean) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,4})?$/, `${label} must be a number with up to 4 decimals`)
    .refine((v) => allowZero || Number(v) > 0, `${label} must be greater than zero`);

export const estimatedPriceSchema = decimalString("Estimated price", true);
export const unitPriceSchema = decimalString("Unit price", false);

const isRealDate = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m! - 1 &&
    date.getUTCDate() === d
  );
};

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine(isRealDate, "That date does not exist")
  .optional()
  .or(z.literal("").transform(() => undefined));

/* ------------------------------------------------------------------ */
/* Exact decimal arithmetic                                            */
/* ------------------------------------------------------------------ */

/**
 * Multiply a decimal string by a whole quantity and sum across lines,
 * returning a 2-dp string. Everything is scaled to integers first, so
 * results do not depend on binary floating-point representation:
 * 0.1 + 0.2 is exactly 0.30 here, and half-way values round up rather
 * than down (`(2.675).toFixed(2)` is "2.67" in JavaScript).
 */
export function sumLineTotals(
  lines: { quantity: number; unitPrice: string }[],
): string {
  // Prices are scaled to 4 decimal places before multiplying.
  let totalScaled = 0n;
  for (const line of lines) {
    const [int, frac = ""] = line.unitPrice.split(".");
    const padded = (frac + "0000").slice(0, 4);
    const priceScaled = BigInt(int + padded);
    totalScaled += priceScaled * BigInt(line.quantity);
  }
  // Round half-up from 4 dp to 2 dp.
  const rounded = (totalScaled + 50n) / 100n;
  const asString = rounded.toString().padStart(3, "0");
  return `${asString.slice(0, -2)}.${asString.slice(-2)}`;
}

/** Compare two decimal strings without going through Number. */
export function compareDecimalStrings(a: string, b: string): number {
  const scale = (v: string): bigint => {
    const [int, frac = ""] = v.split(".");
    return BigInt(int + (frac + "000000").slice(0, 6));
  };
  const left = scale(a);
  const right = scale(b);
  return left === right ? 0 : left > right ? 1 : -1;
}

/**
 * Pick the approval rule that applies to an amount: the highest
 * threshold the amount reaches. Boundary escalates — an amount exactly
 * equal to a threshold requires that tier, never the one below.
 * Returns null when no rule matches (caller must then refuse rather
 * than fall back to an implicit permission).
 */
export function selectApprovalRule<
  T extends { min_amount: string | number; active?: boolean },
>(rules: T[], amount: string): T | null {
  let best: T | null = null;
  for (const rule of rules) {
    if (rule.active === false) continue;
    const threshold = String(rule.min_amount);
    if (compareDecimalStrings(amount, threshold) < 0) continue;
    if (best === null || compareDecimalStrings(threshold, String(best.min_amount)) > 0) {
      best = rule;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

export const createRequestSchema = z.object({
  companyId: uuidSchema,
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  justification: optionalText(2000),
  neededBy: dateSchema,
});

export const updateRequestSchema = z.object({
  requestId: uuidSchema,
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  justification: optionalText(2000),
  neededBy: dateSchema,
});

export const addRequestLineSchema = z.object({
  requestId: uuidSchema,
  productId: uuidSchema,
  variantId: uuidSchema.optional().or(z.literal("").transform(() => undefined)),
  quantity: quantitySchema,
  estimatedUnitPrice: estimatedPriceSchema,
  notes: optionalText(500),
});

export const requestIdSchema = z.object({ requestId: uuidSchema });

export const decideRequestSchema = z.object({
  requestId: uuidSchema,
  decision: z.enum(["approved", "rejected"]),
  reason: reasonSchema,
});

export const cancelRequestSchema = z.object({
  requestId: uuidSchema,
  reason: reasonSchema,
});

export const createOrderSchema = z.object({
  companyId: uuidSchema,
  supplierId: uuidSchema,
  // Phase 05: receiving posts stock, so an order must say where the goods
  // will land before anyone can receive against it.
  warehouseId: uuidSchema,
  requestId: uuidSchema.optional().or(z.literal("").transform(() => undefined)),
  currency: currencySchema,
  exchangeRate: exchangeRateSchema,
  expectedDate: dateSchema,
  terms: optionalText(1000),
});

export const addOrderLineSchema = z.object({
  orderId: uuidSchema,
  productId: uuidSchema,
  variantId: uuidSchema.optional().or(z.literal("").transform(() => undefined)),
  quantity: quantitySchema,
  unitPrice: unitPriceSchema,
  notes: optionalText(500),
});

export const orderIdSchema = z.object({ orderId: uuidSchema });

export const cancelOrderSchema = z.object({
  orderId: uuidSchema,
  reason: reasonSchema,
});

export const receiptLineSchema = z.object({
  orderLineId: uuidSchema,
  acceptedQty: receivedQuantitySchema,
  damagedQty: receivedQuantitySchema,
  missingQty: receivedQuantitySchema,
  extraQty: receivedQuantitySchema,
  note: optionalText(500),
});

export const recordReceiptSchema = z.object({
  orderId: uuidSchema,
  note: optionalText(1000),
  lines: z
    .array(receiptLineSchema)
    .min(1, "A receipt needs at least one line")
    .refine(
      (lines) =>
        lines.some(
          (l) => l.acceptedQty + l.damagedQty + l.missingQty + l.extraQty > 0,
        ),
      "Record at least one quantity",
    ),
});

export const createSampleSchema = z.object({
  companyId: uuidSchema,
  supplierId: uuidSchema,
  productId: uuidSchema.optional().or(z.literal("").transform(() => undefined)),
  variantId: uuidSchema.optional().or(z.literal("").transform(() => undefined)),
  description: z.string().trim().min(3, "Describe the sample").max(500),
  quantity: z.coerce.number().int().positive().max(10_000),
  purpose: optionalText(1000),
});

export const sampleTransitionSchema = z.object({
  sampleId: uuidSchema,
  trackingRef: optionalText(120),
});

export const evaluateSampleSchema = z.object({
  sampleId: uuidSchema,
  outcome: z.enum(["approved", "rejected"]),
  notes: reasonSchema,
});

export const cancelSampleSchema = z.object({
  sampleId: uuidSchema,
  reason: reasonSchema,
});
