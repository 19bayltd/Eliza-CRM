import { z } from "zod";
import { uuidSchema } from "@/server/validation/organization";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email address")
  .max(254);

export const inviteUserSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(1, "Full name is required").max(120),
  roleKey: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]*$/, "Invalid role"),
  companyIds: z.array(uuidSchema).min(1, "Select at least one company"),
});

export const setAccountStatusSchema = z.object({
  userId: uuidSchema,
  status: z.enum(["active", "suspended", "locked", "disabled", "exited"]),
  reason: z.string().trim().min(3, "A reason is required").max(500),
});

export const assignRoleSchema = z.object({
  userId: uuidSchema,
  roleKey: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]*$/, "Invalid role"),
  /** null/undefined = global role grant (requires global authority) */
  companyId: uuidSchema.optional(),
});

export const revokeRoleSchema = z.object({
  userRoleId: uuidSchema,
});

export const companyScopeSchema = z.object({
  userId: uuidSchema,
  companyId: uuidSchema,
});

export const updateProfileSchema = z.object({
  userId: uuidSchema,
  fullName: z.string().trim().min(1, "Full name is required").max(120),
});
