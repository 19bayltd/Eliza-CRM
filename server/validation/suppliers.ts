import { z } from "zod";
import { nameSchema, uuidSchema } from "@/server/validation/organization";
import { reasonSchema } from "@/server/validation/products";

/** Supplier codes: uppercase, digits, underscores, dashes (SUP-CN-001). */
export const supplierCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, "Code must be at least 2 characters")
  .max(40, "Code must be at most 40 characters")
  .regex(
    /^[A-Z0-9][A-Z0-9_-]*$/,
    "Code must be uppercase letters, digits, underscores, or dashes",
  );

const countrySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Country must be a 2-letter ISO code (e.g. CN, BD)");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export const createSupplierSchema = z.object({
  companyId: uuidSchema,
  code: supplierCodeSchema,
  name: nameSchema.pipe(z.string().max(200)),
  country: countrySchema,
  address: optionalText(500),
  capabilities: optionalText(500),
  notes: optionalText(2000),
});

export const updateSupplierSchema = z.object({
  supplierId: uuidSchema,
  name: nameSchema.pipe(z.string().max(200)),
  country: countrySchema,
  address: optionalText(500),
  capabilities: optionalText(500),
  notes: optionalText(2000),
});

export const archiveSupplierEntitySchema = z.object({
  id: uuidSchema,
  reason: reasonSchema,
});

export const createContactSchema = z.object({
  supplierId: uuidSchema,
  name: nameSchema.pipe(z.string().max(120)),
  roleTitle: optionalText(120),
  phone: optionalText(40),
  messaging: optionalText(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address")
    .max(254)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
});

/** Unit prices: up to 4 decimals; validated as a decimal STRING. */
export const unitPriceSchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,4})?$/, "Price must be a number with up to 4 decimals")
  .refine((v) => Number(v) > 0, "Price must be greater than zero");

/** Exchange rate: base-currency units per 1 quote-currency unit. */
export const exchangeRateSchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,6})?$/, "Rate must be a number with up to 6 decimals")
  .refine((v) => Number(v) > 0, "Rate must be greater than zero");

/** Real calendar date check — "2026-02-31" must not reach the database. */
function isRealDate(v: string): boolean {
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m! - 1 &&
    date.getUTCDate() === d
  );
}

export const createQuotationSchema = z.object({
  supplierId: uuidSchema,
  productId: uuidSchema,
  variantId: uuidSchema.optional(),
  unitPrice: unitPriceSchema,
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code"),
  exchangeRate: exchangeRateSchema,
  moq: z
    .string()
    .trim()
    .regex(/^\d*$/, "MOQ must be a whole number")
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || v > 0, "MOQ must be greater than zero")
    .refine((v) => v === undefined || v <= 100_000_000, "MOQ is unrealistically large"),
  leadTimeDays: z
    .string()
    .trim()
    .regex(/^\d*$/, "Lead time must be a whole number of days")
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || v > 0, "Lead time must be greater than zero")
    .refine((v) => v === undefined || v <= 3650, "Lead time must be at most 3650 days"),
  validUntil: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Valid-until must be a date (YYYY-MM-DD)")
    .refine(isRealDate, "Valid-until is not a real calendar date")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  terms: optionalText(1000),
});

/**
 * Exact decimal multiplication for display (unit price x exchange rate →
 * base currency), avoiding IEEE float artifacts like 2.675 x 1 → "2.67".
 * BigInt integer math on the decimal strings, round half-up to 2 dp; a
 * positive result that would round to zero is shown at 4 dp instead.
 */
export function multiplyDecimalStrings(a: string, b: string): string {
  const parse = (s: string): { digits: bigint; scale: number } => {
    const [int, frac = ""] = s.split(".");
    return { digits: BigInt(int + frac), scale: frac.length };
  };
  const x = parse(a);
  const y = parse(b);
  const product = x.digits * y.digits;
  const scale = x.scale + y.scale;

  const format = (value: bigint, from: number, to: number): string => {
    const drop = from - to;
    let scaled = value;
    if (drop > 0) {
      const divisor = 10n ** BigInt(drop);
      const half = divisor / 2n;
      scaled = (value + half) / divisor; // round half-up (inputs positive)
    } else if (drop < 0) {
      scaled = value * 10n ** BigInt(-drop);
    }
    const s = scaled.toString().padStart(to + 1, "0");
    return to === 0 ? s : `${s.slice(0, -to)}.${s.slice(-to)}`;
  };

  const rounded = format(product, scale, 2);
  if (rounded === "0.00" && product > 0n) return format(product, scale, 4);
  return rounded;
}

export const uploadSupplierDocumentSchema = z.object({
  supplierId: uuidSchema,
  title: optionalText(200),
});
