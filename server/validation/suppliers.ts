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
    .refine((v) => v === undefined || v > 0, "MOQ must be greater than zero"),
  leadTimeDays: z
    .string()
    .trim()
    .regex(/^\d*$/, "Lead time must be a whole number of days")
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || v > 0, "Lead time must be greater than zero"),
  validUntil: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Valid-until must be a date (YYYY-MM-DD)")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  terms: optionalText(1000),
});

export const uploadSupplierDocumentSchema = z.object({
  supplierId: uuidSchema,
  title: optionalText(200),
});
