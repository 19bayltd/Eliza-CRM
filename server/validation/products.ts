import { z } from "zod";
import { nameSchema, uuidSchema } from "@/server/validation/organization";

/** Catalog codes (units/attributes): UPPER_SNAKE, same as org codes. */
export const catalogCodeSchema = z
  .string()
  .trim()
  .min(2, "Code must be at least 2 characters")
  .max(40, "Code must be at most 40 characters")
  .regex(
    /^[A-Z0-9][A-Z0-9_]*$/,
    "Code must be UPPER_SNAKE_CASE (letters, digits, underscores)",
  );

/** Category codes additionally allow dashes (e.g. MENS-TSH). */
export const categoryCodeSchema = z
  .string()
  .trim()
  .min(2, "Code must be at least 2 characters")
  .max(40, "Code must be at most 40 characters")
  .regex(
    /^[A-Z0-9][A-Z0-9_-]*$/,
    "Code must be uppercase letters, digits, underscores, or dashes",
  );

/** SKUs: uppercase letters, digits, dashes (e.g. ELS-TSH-0001-BLK-M). */
export const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3, "SKU must be at least 3 characters")
  .max(60, "SKU must be at most 60 characters")
  .regex(
    /^[A-Z0-9][A-Z0-9-]*$/,
    "SKU must be uppercase letters, digits, and dashes",
  );

export const reasonSchema = z
  .string()
  .trim()
  .min(3, "A reason is required")
  .max(500);

export const createUnitSchema = z.object({
  companyId: uuidSchema,
  code: catalogCodeSchema,
  name: nameSchema,
});

export const createCategorySchema = z.object({
  companyId: uuidSchema,
  code: categoryCodeSchema,
  name: nameSchema,
  parentId: uuidSchema.optional(),
});

export const createAttributeSchema = z.object({
  companyId: uuidSchema,
  code: catalogCodeSchema,
  name: nameSchema,
});

export const createAttributeValueSchema = z.object({
  attributeId: uuidSchema,
  value: z.string().trim().min(1, "Value is required").max(80),
});

export const archiveCatalogEntitySchema = z.object({
  id: uuidSchema,
  reason: reasonSchema,
});

export const createProductSchema = z.object({
  companyId: uuidSchema,
  sku: skuSchema,
  name: nameSchema.pipe(z.string().max(200)),
  description: z.string().trim().max(5000).optional(),
  categoryId: uuidSchema.optional(),
  unitId: uuidSchema.optional(),
});

export const updateProductSchema = z.object({
  productId: uuidSchema,
  name: nameSchema.pipe(z.string().max(200)),
  description: z.string().trim().max(5000).optional(),
  categoryId: uuidSchema.optional(),
  unitId: uuidSchema.optional(),
});

/** Product status machine (draft → active → archived; archived → active). */
export const PRODUCT_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ["active"],
  active: ["archived"],
  archived: ["active"],
};

export const setProductStatusSchema = z.object({
  productId: uuidSchema,
  status: z.enum(["active", "archived"]),
  reason: reasonSchema,
});

export const createVariantSchema = z.object({
  productId: uuidSchema,
  sku: skuSchema,
  /** attributeId -> attributeValueId */
  attributeValueIds: z.array(uuidSchema).max(10).default([]),
});

export const setVariantStatusSchema = z.object({
  variantId: uuidSchema,
  status: z.enum(["active", "archived"]),
  reason: reasonSchema,
});

export const upsertIntelligenceSchema = z.object({
  productId: uuidSchema,
  sourcingNotes: z.string().trim().max(5000).optional(),
  targetCost: z
    .string()
    .trim()
    .regex(/^\d{1,12}(\.\d{1,2})?$/, "Cost must be a number with up to 2 decimals")
    .optional()
    .or(z.literal("")),
  targetCostCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code")
    .optional()
    .or(z.literal("")),
  remarks: z.string().trim().max(5000).optional(),
});

export const uploadProductImageSchema = z.object({
  productId: uuidSchema,
  variantId: uuidSchema.optional(),
  tier: z.enum(["public", "confidential"]),
});

export const importValidateSchema = z.object({
  companyId: uuidSchema,
  filename: z.string().trim().min(1).max(200),
  csv: z.string().min(1, "The CSV file is empty").max(2_000_000),
});

export const importApplySchema = z.object({
  jobId: uuidSchema,
});

/** Expected CSV header for the product import template. */
export const IMPORT_COLUMNS = [
  "sku",
  "name",
  "category_code",
  "unit_code",
  "variant_sku",
  "description",
] as const;

export type ImportRow = Record<(typeof IMPORT_COLUMNS)[number], string>;

export type PlannedImportRow = {
  rowNumber: number;
  raw: Record<string, string>;
  action: "create_product" | "create_variant" | "update_product" | "reject";
  message: string | null;
};

/**
 * Pure import-planning core (unit-tested): decides per CSV row whether it
 * creates a product, adds a variant, updates a product, or is rejected —
 * and why. The service wraps this with permissions, lookups, and storage.
 */
export function planImportRows(params: {
  header: string[];
  rows: string[][];
  existingProductSkus: Set<string>;
  existingVariantSkus: Set<string>;
  activeCategoryCodes: Set<string>;
  activeUnitCodes: Set<string>;
}): PlannedImportRow[] {
  const { header, rows } = params;
  const colIndex = new Map(header.map((h, i) => [h, i]));
  const planned: PlannedImportRow[] = [];
  const seenProductSkusInFile = new Set<string>();
  const seenVariantSkusInFile = new Set<string>();

  const cell = (row: string[], col: (typeof IMPORT_COLUMNS)[number]) => {
    const idx = colIndex.get(col);
    return idx === undefined ? "" : (row[idx] ?? "").trim();
  };

  rows.forEach((row, i) => {
    const rowNumber = i + 2; // 1-based + header line
    const raw = Object.fromEntries(
      IMPORT_COLUMNS.map((c) => [c, cell(row, c)]),
    ) as Record<string, string>;

    const reject = (message: string) =>
      planned.push({ rowNumber, raw, action: "reject", message });

    if (row.length !== header.length) {
      return reject(`Column count ${row.length} does not match header (${header.length})`);
    }

    const skuParse = skuSchema.safeParse(raw.sku ?? "");
    if (!skuParse.success) {
      return reject(`Invalid sku: ${skuParse.error.issues[0]?.message ?? "invalid"}`);
    }
    const sku = skuParse.data;

    let variantSku: string | null = null;
    if (raw.variant_sku) {
      const variantParse = skuSchema.safeParse(raw.variant_sku);
      if (!variantParse.success) {
        return reject(
          `Invalid variant_sku: ${variantParse.error.issues[0]?.message ?? "invalid"}`,
        );
      }
      variantSku = variantParse.data;
      if (params.existingVariantSkus.has(variantSku)) {
        return reject(`variant_sku ${variantSku} already exists in this company`);
      }
      if (seenVariantSkusInFile.has(variantSku)) {
        return reject(`variant_sku ${variantSku} appears more than once in the file`);
      }
    }

    if (raw.category_code && !params.activeCategoryCodes.has(raw.category_code)) {
      return reject(`category_code ${raw.category_code} does not exist (active) in this company`);
    }
    if (raw.unit_code && !params.activeUnitCodes.has(raw.unit_code)) {
      return reject(`unit_code ${raw.unit_code} does not exist (active) in this company`);
    }

    const productExists =
      params.existingProductSkus.has(sku) || seenProductSkusInFile.has(sku);

    if (!productExists) {
      if (!raw.name) return reject("name is required for a new product");
      seenProductSkusInFile.add(sku);
      if (variantSku) seenVariantSkusInFile.add(variantSku);
      return planned.push({
        rowNumber,
        raw,
        action: "create_product",
        message: variantSku
          ? `Creates product ${sku} and variant ${variantSku}`
          : `Creates product ${sku}`,
      });
    }

    if (variantSku) {
      seenVariantSkusInFile.add(variantSku);
      return planned.push({
        rowNumber,
        raw,
        action: "create_variant",
        message: `Adds variant ${variantSku} to product ${sku}`,
      });
    }

    if (params.existingProductSkus.has(sku)) {
      return planned.push({
        rowNumber,
        raw,
        action: "update_product",
        message: `Updates product ${sku}`,
      });
    }
    return reject(`Duplicate product row for ${sku} without a variant_sku`);
  });

  return planned;
}

/**
 * Minimal CSV parser for the product-import template: comma-separated,
 * double-quote quoting with "" escapes, CRLF/LF tolerant. Deliberately
 * dependency-free; rejects rows whose column count differs from the
 * header instead of guessing.
 */
export function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    // Skip blank lines (a single empty field).
    if (!(row.length === 1 && row[0]?.trim() === "")) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch === "\r") {
      // handled by the following \n (or ignored for lone \r)
      if (text[i + 1] !== "\n") pushRow();
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) pushRow();

  const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  return { header, rows };
}
