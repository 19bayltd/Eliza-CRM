import { z } from "zod";

/**
 * Environment validation. Public variables are safe for the browser;
 * server variables must never reach the client. The service-role key is
 * validated only inside `serverEnv()` which is imported exclusively from
 * server-only modules.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

export function publicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid public environment configuration: ${parsed.error.issues
        .map((i) => i.path.join("."))
        .join(", ")}`,
    );
  }
  return parsed.data;
}

export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must never be called in the browser");
  }
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) {
    // Never echo values — names only.
    throw new Error(
      `Invalid server environment configuration: ${parsed.error.issues
        .map((i) => i.path.join("."))
        .join(", ")}`,
    );
  }
  return parsed.data;
}
