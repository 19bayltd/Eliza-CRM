import { describe, expect, it } from "vitest";
import {
  PRODUCT_STATUS_TRANSITIONS,
  parseCsv,
  planImportRows,
  skuSchema,
} from "@/server/validation/products";

describe("skuSchema", () => {
  it("accepts uppercase alphanumerics with dashes", () => {
    expect(skuSchema.parse("ELS-TSH-0001")).toBe("ELS-TSH-0001");
    expect(skuSchema.parse("A1-B2-C3")).toBe("A1-B2-C3");
  });
  it("uppercases lowercase input", () => {
    expect(skuSchema.parse("els-tsh-0001")).toBe("ELS-TSH-0001");
  });
  it("rejects underscores, spaces, and leading dash", () => {
    expect(skuSchema.safeParse("ELS_TSH").success).toBe(false);
    expect(skuSchema.safeParse("ELS TSH").success).toBe(false);
    expect(skuSchema.safeParse("-ELS").success).toBe(false);
  });
  it("rejects too-short and too-long values", () => {
    expect(skuSchema.safeParse("AB").success).toBe(false);
    expect(skuSchema.safeParse("A".repeat(61)).success).toBe(false);
  });
});

describe("product status machine", () => {
  it("allows draft→active, active→archived, archived→active only", () => {
    expect(PRODUCT_STATUS_TRANSITIONS.draft).toEqual(["active"]);
    expect(PRODUCT_STATUS_TRANSITIONS.active).toEqual(["archived"]);
    expect(PRODUCT_STATUS_TRANSITIONS.archived).toEqual(["active"]);
  });
  it("never allows draft→archived or self-transitions", () => {
    expect(PRODUCT_STATUS_TRANSITIONS.draft).not.toContain("archived");
    for (const [from, tos] of Object.entries(PRODUCT_STATUS_TRANSITIONS)) {
      expect(tos).not.toContain(from);
    }
  });
});

describe("parseCsv", () => {
  it("parses simple rows with a lowercased header", () => {
    const { header, rows } = parseCsv("SKU,Name\nA-1,Shirt\nB-2,Pant\n");
    expect(header).toEqual(["sku", "name"]);
    expect(rows).toEqual([
      ["A-1", "Shirt"],
      ["B-2", "Pant"],
    ]);
  });
  it("handles quoted fields with commas and escaped quotes", () => {
    const { rows } = parseCsv('sku,name\nA-1,"Shirt, ""Premium"""\n');
    expect(rows).toEqual([["A-1", 'Shirt, "Premium"']]);
  });
  it("tolerates CRLF and skips blank lines", () => {
    const { rows } = parseCsv("sku,name\r\nA-1,Shirt\r\n\r\nB-2,Pant\r\n");
    expect(rows).toHaveLength(2);
  });
});

function plan(rows: string[][], overrides?: Partial<Parameters<typeof planImportRows>[0]>) {
  return planImportRows({
    header: ["sku", "name", "category_code", "unit_code", "variant_sku", "description"],
    rows,
    existingProductSkus: new Set(),
    existingVariantSkus: new Set(),
    activeCategoryCodes: new Set(["MENS-TSH"]),
    activeUnitCodes: new Set(["PCS"]),
    ...overrides,
  });
}

describe("planImportRows", () => {
  it("plans a new product with its variant on one row", () => {
    const [row] = plan([["ELS-TSH-0001", "Tee", "MENS-TSH", "PCS", "ELS-TSH-0001-M", ""]]);
    expect(row?.action).toBe("create_product");
  });

  it("plans create_variant for later rows of the same file product", () => {
    const planned = plan([
      ["ELS-TSH-0001", "Tee", "", "", "ELS-TSH-0001-M", ""],
      ["ELS-TSH-0001", "", "", "", "ELS-TSH-0001-L", ""],
    ]);
    expect(planned.map((r) => r.action)).toEqual(["create_product", "create_variant"]);
  });

  it("plans update_product for an existing SKU without variant_sku", () => {
    const [row] = plan([["ELS-TSH-0001", "New name", "", "", "", ""]], {
      existingProductSkus: new Set(["ELS-TSH-0001"]),
    });
    expect(row?.action).toBe("update_product");
  });

  it("rejects an invalid sku", () => {
    const [row] = plan([["bad sku!", "Tee", "", "", "", ""]]);
    expect(row?.action).toBe("reject");
    expect(row?.message).toMatch(/Invalid sku/);
  });

  it("rejects a new product without a name", () => {
    const [row] = plan([["ELS-TSH-0002", "", "", "", "", ""]]);
    expect(row?.action).toBe("reject");
    expect(row?.message).toMatch(/name is required/);
  });

  it("rejects an unknown category code", () => {
    const [row] = plan([["ELS-TSH-0001", "Tee", "NOPE", "", "", ""]]);
    expect(row?.action).toBe("reject");
    expect(row?.message).toMatch(/category_code/);
  });

  it("rejects a variant SKU that already exists in the company", () => {
    const [row] = plan([["ELS-TSH-0001", "Tee", "", "", "ELS-TSH-0001-M", ""]], {
      existingVariantSkus: new Set(["ELS-TSH-0001-M"]),
    });
    expect(row?.action).toBe("reject");
    expect(row?.message).toMatch(/already exists/);
  });

  it("rejects a duplicate variant SKU within the file", () => {
    const planned = plan([
      ["ELS-TSH-0001", "Tee", "", "", "ELS-TSH-0001-M", ""],
      ["ELS-TSH-0001", "", "", "", "ELS-TSH-0001-M", ""],
    ]);
    expect(planned[1]?.action).toBe("reject");
    expect(planned[1]?.message).toMatch(/more than once/);
  });

  it("rejects duplicate product rows without a variant", () => {
    const planned = plan([
      ["ELS-TSH-0001", "Tee", "", "", "", ""],
      ["ELS-TSH-0001", "Tee", "", "", "", ""],
    ]);
    expect(planned[1]?.action).toBe("reject");
  });

  it("rejects rows whose column count differs from the header", () => {
    const [row] = plan([["ELS-TSH-0001", "Tee"]]);
    expect(row?.action).toBe("reject");
    expect(row?.message).toMatch(/Column count/);
  });
});
