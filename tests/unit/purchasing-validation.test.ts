import { describe, expect, it } from "vitest";
import {
  compareDecimalStrings,
  createRequestSchema,
  quantitySchema,
  recordReceiptSchema,
  selectApprovalRule,
  sumLineTotals,
  unitPriceSchema,
} from "@/server/validation/purchasing";

describe("quantitySchema", () => {
  it("accepts whole positive numbers as strings or numbers", () => {
    expect(quantitySchema.parse("500")).toBe(500);
    expect(quantitySchema.parse(1)).toBe(1);
  });
  it("rejects fractions, zero, negatives, and absurd quantities", () => {
    expect(quantitySchema.safeParse("1.5").success).toBe(false);
    expect(quantitySchema.safeParse("0").success).toBe(false);
    expect(quantitySchema.safeParse("-5").success).toBe(false);
    expect(quantitySchema.safeParse("2000000").success).toBe(false);
  });
});

describe("unitPriceSchema", () => {
  it("accepts decimal strings up to 4 places", () => {
    expect(unitPriceSchema.parse("1.8500")).toBe("1.8500");
  });
  it("rejects zero, negatives, and over-precise values", () => {
    expect(unitPriceSchema.safeParse("0").success).toBe(false);
    expect(unitPriceSchema.safeParse("-1").success).toBe(false);
    expect(unitPriceSchema.safeParse("1.12345").success).toBe(false);
  });
});

describe("sumLineTotals", () => {
  it("multiplies quantity by price exactly", () => {
    expect(sumLineTotals([{ quantity: 500, unitPrice: "1.85" }])).toBe("925.00");
  });
  it("sums across lines without floating-point drift", () => {
    // 0.1 + 0.2 is 0.30000000000000004 in IEEE arithmetic.
    expect(
      sumLineTotals([
        { quantity: 1, unitPrice: "0.1" },
        { quantity: 1, unitPrice: "0.2" },
      ]),
    ).toBe("0.30");
  });
  it("rounds half-up where toFixed rounds down", () => {
    // (2.675).toFixed(2) === "2.67"
    expect(sumLineTotals([{ quantity: 1, unitPrice: "2.675" }])).toBe("2.68");
  });
  it("stays exact over many lines and large quantities", () => {
    const lines = Array.from({ length: 100 }, () => ({
      quantity: 3,
      unitPrice: "0.07",
    }));
    expect(sumLineTotals(lines)).toBe("21.00");
  });
  it("returns 0.00 for no lines", () => {
    expect(sumLineTotals([])).toBe("0.00");
  });
});

describe("compareDecimalStrings", () => {
  it("compares by value, not lexically", () => {
    expect(compareDecimalStrings("9", "10")).toBe(-1);
    expect(compareDecimalStrings("500000.00", "500000")).toBe(0);
    expect(compareDecimalStrings("500000.0001", "500000")).toBe(1);
  });
});

describe("selectApprovalRule", () => {
  const base = { min_amount: "0", required_permission: "purchasing.request.approve" };
  const high = {
    min_amount: "500000",
    required_permission: "purchasing.request.approve.high",
  };
  const rules = [base, high];

  it("uses the base rule below the threshold", () => {
    expect(selectApprovalRule(rules, "1000")?.required_permission).toBe(
      "purchasing.request.approve",
    );
  });
  it("escalates at exactly the threshold, not above it", () => {
    expect(selectApprovalRule(rules, "500000")?.required_permission).toBe(
      "purchasing.request.approve.high",
    );
    expect(selectApprovalRule(rules, "499999.99")?.required_permission).toBe(
      "purchasing.request.approve",
    );
  });
  it("picks the highest matching tier regardless of rule order", () => {
    expect(selectApprovalRule([high, base], "900000")?.required_permission).toBe(
      "purchasing.request.approve.high",
    );
  });
  it("ignores inactive rules", () => {
    const disabled = [{ ...high, active: false }, base];
    expect(selectApprovalRule(disabled, "900000")?.required_permission).toBe(
      "purchasing.request.approve",
    );
  });
  it("returns null when nothing matches, so callers fail closed", () => {
    expect(selectApprovalRule([{ min_amount: "1000" }], "999")).toBeNull();
    expect(selectApprovalRule([], "100")).toBeNull();
  });
});

describe("createRequestSchema", () => {
  const companyId = "00000000-0000-4000-8000-000000000001";
  it("accepts a title and optional fields", () => {
    const parsed = createRequestSchema.parse({
      companyId,
      title: "Winter fabric",
      justification: "",
      neededBy: "",
    });
    expect(parsed.justification).toBeUndefined();
    expect(parsed.neededBy).toBeUndefined();
  });
  it("rejects impossible calendar dates", () => {
    expect(
      createRequestSchema.safeParse({
        companyId,
        title: "Winter fabric",
        neededBy: "2026-02-31",
      }).success,
    ).toBe(false);
  });
  it("rejects a too-short title", () => {
    expect(
      createRequestSchema.safeParse({ companyId, title: "ab" }).success,
    ).toBe(false);
  });
});

describe("recordReceiptSchema", () => {
  const orderId = "00000000-0000-4000-8000-000000000001";
  const lineId = "00000000-0000-4000-8000-000000000002";

  it("accepts a mixed receipt with zeroes in some columns", () => {
    const parsed = recordReceiptSchema.parse({
      orderId,
      lines: [
        {
          orderLineId: lineId,
          acceptedQty: "8",
          damagedQty: "1",
          missingQty: "1",
          extraQty: "0",
        },
      ],
    });
    expect(parsed.lines[0]!.acceptedQty).toBe(8);
    expect(parsed.lines[0]!.extraQty).toBe(0);
  });

  it("rejects a receipt where every quantity is zero", () => {
    expect(
      recordReceiptSchema.safeParse({
        orderId,
        lines: [
          {
            orderLineId: lineId,
            acceptedQty: "0",
            damagedQty: "0",
            missingQty: "0",
            extraQty: "0",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects an empty receipt and negative quantities", () => {
    expect(recordReceiptSchema.safeParse({ orderId, lines: [] }).success).toBe(false);
    expect(
      recordReceiptSchema.safeParse({
        orderId,
        lines: [
          {
            orderLineId: lineId,
            acceptedQty: "-1",
            damagedQty: "0",
            missingQty: "0",
            extraQty: "0",
          },
        ],
      }).success,
    ).toBe(false);
  });
});
