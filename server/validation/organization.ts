import { z } from "zod";

export const codeSchema = z
  .string()
  .trim()
  .min(2, "Code must be at least 2 characters")
  .max(40, "Code must be at most 40 characters")
  .regex(
    /^[A-Z0-9][A-Z0-9_]*$/,
    "Code must be UPPER_SNAKE_CASE (letters, digits, underscores)",
  );

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(120, "Name must be at most 120 characters");

export const uuidSchema = z.string().uuid("Invalid identifier");

export const createCompanySchema = z.object({
  code: codeSchema,
  name: nameSchema,
  baseCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code"),
  timezone: z.string().trim().min(1).max(64).default("Asia/Dhaka"),
});

export const updateCompanySchema = z.object({
  companyId: uuidSchema,
  name: nameSchema,
  baseCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code"),
  timezone: z.string().trim().min(1).max(64),
});

export const createBranchSchema = z.object({
  companyId: uuidSchema,
  code: codeSchema,
  name: nameSchema,
});

export const createWarehouseSchema = z.object({
  companyId: uuidSchema,
  branchId: uuidSchema.optional(),
  code: codeSchema,
  name: nameSchema,
});

export const createDepartmentSchema = z.object({
  companyId: uuidSchema,
  branchId: uuidSchema.optional(),
  code: codeSchema,
  name: nameSchema,
});

export const archiveEntitySchema = z.object({
  id: uuidSchema,
  reason: z.string().trim().min(3, "A reason is required").max(500),
});
