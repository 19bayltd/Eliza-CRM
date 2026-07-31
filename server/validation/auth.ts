import { z } from "zod";
import { emailSchema } from "@/server/validation/users";

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(200),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const setPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(200),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
