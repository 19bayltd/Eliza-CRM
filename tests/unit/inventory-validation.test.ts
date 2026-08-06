import { describe, expect, it } from "vitest";
import {
  ALL_TXN_TYPES,
  MANUAL_TXN_TYPES,
  countVariance,
  createTransferSchema,
  magnitudeSchema,
  postMovementSchema,
  receiveTransferSchema,
  signMatchesType,
  signedQuantitySchema,
  type TxnType,
} from "@/server/validation/inventory";

const UUID_A = "00000000-0000-4000-8000-000000000001";
const UUID_B = "00000000-0000-4000-8000-000000000002";
const UUID_C = "00000000-0000-4000-8000-000000000003";

describe("transaction types", () => {
  it("covers all twelve types from the architecture", () => {
    expect(ALL_TXN_TYPES).toHaveLength(12);
    for (const t of [
      "opening_stock",
      "purchase_receipt",
      "transfer_out",
      "transfer_in",
      "damage",
      "adjustment",
      "count_correction",
      "supplier_return",
      "sale",
      "customer_return",
      "reservation",
      "reservation_release",
    ]) {
      expect(ALL_TXN_TYPES).toContain(t);
    }
  });

  it("only exposes the three a human may post directly in this phase", () => {
    expect([...MANUAL_TXN_TYPES]).toEqual([
      "opening_stock",
      "damage",
      "supplier_return",
    ]);
  });

  it("refuses types belonging to later phases", () => {
    for (const type of ["sale", "reservation", "customer_return", "transfer_in"]) {
      const result = postMovementSchema.safeParse({
        companyId: UUID_A,
        warehouseId: UUID_B,
        productId: UUID_C,
        txnType: type,
        quantity: "5",
        reason: "test",
      });
      expect(result.success).toBe(false);
    }
  });
});

describe("signMatchesType", () => {
  it("requires inbound types to be positive", () => {
    expect(signMatchesType("purchase_receipt", 5)).toBe(true);
    expect(signMatchesType("purchase_receipt", -5)).toBe(false);
    expect(signMatchesType("transfer_in", -1)).toBe(false);
  });
  it("requires outbound types to be negative", () => {
    expect(signMatchesType("damage", -5)).toBe(true);
    expect(signMatchesType("damage", 5)).toBe(false);
    expect(signMatchesType("sale", 1)).toBe(false);
  });
  it("allows either sign for corrections, but never zero", () => {
    expect(signMatchesType("adjustment", 5)).toBe(true);
    expect(signMatchesType("adjustment", -5)).toBe(true);
    expect(signMatchesType("count_correction", 3)).toBe(true);
    expect(signMatchesType("adjustment", 0)).toBe(false);
  });
  it("rejects zero for every type", () => {
    for (const type of ALL_TXN_TYPES) {
      expect(signMatchesType(type as TxnType, 0)).toBe(false);
    }
  });
});

describe("quantity schemas", () => {
  it("accepts whole positive magnitudes", () => {
    expect(magnitudeSchema.parse("100")).toBe(100);
  });
  it("rejects zero, negatives and fractions as magnitudes", () => {
    expect(magnitudeSchema.safeParse("0").success).toBe(false);
    expect(magnitudeSchema.safeParse("-1").success).toBe(false);
    expect(magnitudeSchema.safeParse("1.5").success).toBe(false);
  });
  it("accepts signed deltas for adjustments but not zero", () => {
    expect(signedQuantitySchema.parse("-5")).toBe(-5);
    expect(signedQuantitySchema.parse("5")).toBe(5);
    expect(signedQuantitySchema.safeParse("0").success).toBe(false);
  });
});

describe("countVariance", () => {
  it("returns null when the line was not counted", () => {
    expect(countVariance({ system_qty: 10, counted_qty: null })).toBeNull();
  });
  it("returns null when the count matches, so nothing posts", () => {
    expect(countVariance({ system_qty: 10, counted_qty: 10 })).toBeNull();
  });
  it("returns the signed difference otherwise", () => {
    expect(countVariance({ system_qty: 10, counted_qty: 7 })).toBe(-3);
    expect(countVariance({ system_qty: 10, counted_qty: 12 })).toBe(2);
  });
  it("handles counting an empty shelf that the system thought had stock", () => {
    expect(countVariance({ system_qty: 4, counted_qty: 0 })).toBe(-4);
  });
});

describe("createTransferSchema", () => {
  it("refuses a transfer to the same warehouse", () => {
    const result = createTransferSchema.safeParse({
      companyId: UUID_A,
      fromWarehouse: UUID_B,
      toWarehouse: UUID_B,
    });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0]?.message).toBe(
      "Choose two different warehouses",
    );
  });
  it("accepts two different warehouses", () => {
    expect(
      createTransferSchema.safeParse({
        companyId: UUID_A,
        fromWarehouse: UUID_B,
        toWarehouse: UUID_C,
      }).success,
    ).toBe(true);
  });
});

describe("receiveTransferSchema", () => {
  it("accepts zero for a line that did not arrive", () => {
    const parsed = receiveTransferSchema.parse({
      transferId: UUID_A,
      lines: [{ lineId: UUID_B, receivedQty: "0" }],
    });
    expect(parsed.lines[0]!.receivedQty).toBe(0);
  });
  it("rejects an empty receipt and negative quantities", () => {
    expect(receiveTransferSchema.safeParse({ transferId: UUID_A, lines: [] }).success).toBe(
      false,
    );
    expect(
      receiveTransferSchema.safeParse({
        transferId: UUID_A,
        lines: [{ lineId: UUID_B, receivedQty: "-1" }],
      }).success,
    ).toBe(false);
  });
});

describe("postMovementSchema", () => {
  const base = {
    companyId: UUID_A,
    warehouseId: UUID_B,
    productId: UUID_C,
    quantity: "10",
    reason: "Stock take",
  };

  it("treats the override as opt-in only", () => {
    expect(postMovementSchema.parse({ ...base, txnType: "damage" }).allowNegative).toBe(
      false,
    );
    expect(
      postMovementSchema.parse({ ...base, txnType: "damage", allowNegative: "on" })
        .allowNegative,
    ).toBe(true);
  });

  it("requires a reason of at least three characters", () => {
    expect(
      postMovementSchema.safeParse({ ...base, txnType: "damage", reason: "x" }).success,
    ).toBe(false);
  });
});
