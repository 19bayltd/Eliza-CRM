import { describe, expect, it } from "vitest";
import {
  createQuotationSchema,
  exchangeRateSchema,
  multiplyDecimalStrings,
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

  it("rejects impossible calendar dates (review finding)", () => {
    expect(
      createQuotationSchema.safeParse({ ...base, validUntil: "2026-02-31" }).success,
    ).toBe(false);
    expect(
      createQuotationSchema.safeParse({ ...base, validUntil: "2026-99-99" }).success,
    ).toBe(false);
  });

  it("rejects integer-overflow MOQ and absurd lead times (review finding)", () => {
    expect(createQuotationSchema.safeParse({ ...base, moq: "9999999999" }).success).toBe(false);
    expect(
      createQuotationSchema.safeParse({ ...base, leadTimeDays: "99999" }).success,
    ).toBe(false);
  });
});

describe("multiplyDecimalStrings (review finding: float misranking)", () => {
  it("rounds half-up where IEEE floats round down", () => {
    // (2.675 * 1).toFixed(2) === "2.67" in JS; decimal math must give 2.68.
    expect(multiplyDecimalStrings("2.675", "1")).toBe("2.68");
  });
  it("computes the canonical example exactly", () => {
    // Note: this pair does NOT discriminate — (1.85 * 121.5).toFixed(2) is
    // also "224.78". It guards the value, not the implementation.
    expect(multiplyDecimalStrings("1.85", "121.5")).toBe("224.78");
  });
  it("differs from float on a realistic price/rate pair", () => {
    // 1.07 * 121.50 = 130.005 exactly; the float product falls just below,
    // so (1.07 * 121.5).toFixed(2) === "130.00". Decimal math must give
    // 130.01. This is the pair used for live browser verification.
    expect(multiplyDecimalStrings("1.07", "121.50")).toBe("130.01");
    expect((1.07 * 121.5).toFixed(2)).toBe("130.00");
  });
  it("keeps tiny positive prices visible instead of showing 0.00", () => {
    expect(multiplyDecimalStrings("0.0001", "1")).toBe("0.0001");
  });
  it("handles integer inputs and large rates", () => {
    expect(multiplyDecimalStrings("210", "1")).toBe("210.00");
    expect(multiplyDecimalStrings("1.8500", "121.500000")).toBe("224.78");
  });
});
