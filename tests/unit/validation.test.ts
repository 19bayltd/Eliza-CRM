import { describe, expect, it } from "vitest";
import {
  createCompanySchema,
  createBranchSchema,
} from "@/server/validation/organization";
import { inviteUserSchema, setAccountStatusSchema } from "@/server/validation/users";
import { setPasswordSchema, signInSchema } from "@/server/validation/auth";

const UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("organization validation", () => {
  it("accepts the three approved companies, including digit-leading 19BAY", () => {
    for (const [code, name, currency] of [
      ["ELIZA_SOURCE", "Eliza Source", "BDT"],
      ["19BAY", "19BAY", "BDT"],
      ["ONE_AND_NINE", "1 & 9", "USD"],
    ] as const) {
      const parsed = createCompanySchema.safeParse({
        code,
        name,
        baseCurrency: currency,
        timezone: "Asia/Dhaka",
      });
      expect(parsed.success, code).toBe(true);
    }
  });

  it("rejects bad codes, currencies, and blank names", () => {
    expect(
      createCompanySchema.safeParse({ code: "bad code", name: "X", baseCurrency: "BDT" }).success,
    ).toBe(false);
    expect(
      createCompanySchema.safeParse({ code: "OK_CODE", name: "X", baseCurrency: "TAKA" }).success,
    ).toBe(false);
    expect(
      createCompanySchema.safeParse({ code: "OK_CODE", name: "   ", baseCurrency: "BDT" }).success,
    ).toBe(false);
  });

  it("requires a valid company id on branches", () => {
    expect(
      createBranchSchema.safeParse({ companyId: "not-a-uuid", code: "MAIN", name: "Main" }).success,
    ).toBe(false);
    expect(
      createBranchSchema.safeParse({ companyId: UUID, code: "MAIN", name: "Main" }).success,
    ).toBe(true);
  });
});

describe("user validation", () => {
  it("normalizes email and requires at least one company", () => {
    const parsed = inviteUserSchema.safeParse({
      email: "  User@Example.COM ",
      fullName: "User",
      roleKey: "employee",
      companyIds: [UUID],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("user@example.com");

    expect(
      inviteUserSchema.safeParse({
        email: "u@example.com",
        fullName: "User",
        roleKey: "employee",
        companyIds: [],
      }).success,
    ).toBe(false);
  });

  it("requires a reason for status changes and rejects unknown statuses", () => {
    expect(
      setAccountStatusSchema.safeParse({ userId: UUID, status: "suspended", reason: "policy violation" }).success,
    ).toBe(true);
    expect(
      setAccountStatusSchema.safeParse({ userId: UUID, status: "suspended", reason: "" }).success,
    ).toBe(false);
    expect(
      setAccountStatusSchema.safeParse({ userId: UUID, status: "deleted", reason: "x" }).success,
    ).toBe(false);
  });
});

describe("auth validation", () => {
  it("enforces the 12-character password minimum and match", () => {
    expect(
      setPasswordSchema.safeParse({ password: "short", confirmPassword: "short" }).success,
    ).toBe(false);
    expect(
      setPasswordSchema.safeParse({
        password: "long-enough-password",
        confirmPassword: "different-password!!",
      }).success,
    ).toBe(false);
    expect(
      setPasswordSchema.safeParse({
        password: "long-enough-password",
        confirmPassword: "long-enough-password",
      }).success,
    ).toBe(true);
  });

  it("requires well-formed sign-in input", () => {
    expect(signInSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});
