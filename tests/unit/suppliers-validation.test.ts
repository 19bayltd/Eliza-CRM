import { describe, expect, it } from "vitest";
import {
  createQuotationSchema,
  exchangeRateSchema,
  supplierCodeSchema,
  unitPriceSchema,
} from "@/server/validation/suppliers";

describe("supplierCodeSchema", () => {
  it("accepts and uppercases codes with dashes and underscores", () => {
    expect(supplierCodeSchema.parse("sup-cn-001")).toBe("SUP-CN-001");
    expect(supplierCodeSchema.parse("SUP_BD_9")).toBe("SUP_BD_9");
  });
  it("rejects spaces, leading dash, and too-short codes", () => {
    expect(supplierCodeSchema.safeParse("SUP 1").success).toBe(false);
    expect(supplierCodeSchema.safeParse("-SUP").success).toBe(false);
    expect(supplierCodeSchema.safeParse("S").success).toBe(false);
  });
});

describe("unitPriceSchema", () => {
  it("accepts up to 4 decimals as a string", () => {
    expect(unitPriceSchema.parse("1.855")).toBe("1.855");
    expect(unitPriceSchema.parse("210")).toBe("210");
  });
  it("rejects zero, negatives, and >4 decimals", () => {
    expect(unitPriceSchema.safeParse("0").success).toBe(false);
    expect(unitPriceSchema.safeParse("-5").success).toBe(false);
    expect(unitPriceSchema.safeParse("1.12345").success).toBe(false);
  });
});

describe("exchangeRateSchema", () => {
  it("accepts up to 6 decimals", () => {
    expect(exchangeRateSchema.parse("121.5")).toBe("121.5");
    expect(exchangeRateSchema.parse("0.008230")).toBe("0.008230");
  });
  it("rejects zero and non-numbers", () => {
    expect(exchangeRateSchema.safeParse("0").success).toBe(false);
    expect(exchangeRateSchema.safeParse("abc").success).toBe(false);
  });
});

const UUID_A = "00000000-0000-4000-8000-000000000001";
const UUID_B = "00000000-0000-4000-8000-000000000002";

describe("createQuotationSchema", () => {
  const base = {
    supplierId: UUID_A,
    productId: UUID_B,
    unitPrice: "1.85",
    currency: "usd",
    exchangeRate: "121.50",
  };

  it("normalizes currency to uppercase and coerces numbers", () => {
    const parsed = createQuotationSchema.parse({
      ...base,
      moq: "500",
      leadTimeDays: "45",
      validUntil: "2026-09-30",
    });
    expect(parsed.currency).toBe("USD");
    expect(parsed.moq).toBe(500);
    expect(parsed.leadTimeDays).toBe(45);
    expect(parsed.validUntil).toBe("2026-09-30");
  });

  it("treats empty optional fields as absent", () => {
    const parsed = createQuotationSchema.parse({ ...base, validUntil: "" });
    expect(parsed.moq).toBeUndefined();
    expect(parsed.validUntil).toBeUndefined();
  });

  it("rejects a zero MOQ and malformed dates", () => {
    expect(createQuotationSchema.safeParse({ ...base, moq: "0" }).success).toBe(false);
    expect(
      createQuotationSchema.safeParse({ ...base, validUntil: "30-09-2026" }).success,
    ).toBe(false);
  });

  it("rejects a bad currency code", () => {
    expect(
      createQuotationSchema.safeParse({ ...base, currency: "US" }).success,
    ).toBe(false);
  });
});
