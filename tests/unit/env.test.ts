import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publicEnv, serverEnv } from "@/lib/env";

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("env validation", () => {
  it("accepts a complete public configuration", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_0123456789";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(publicEnv().NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("rejects missing or malformed public variables, naming only the variable", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_0123456789";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(() => publicEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("requires the service-role key server-side and never echoes its value", () => {
    expect(() => serverEnv()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_0123456789_abcdef";
    expect(serverEnv().SUPABASE_SERVICE_ROLE_KEY).toBeTruthy();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      serverEnv();
      expect.unreachable();
    } catch (err) {
      expect(String(err)).not.toContain("sb_secret");
    }
  });
});
