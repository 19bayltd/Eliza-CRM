import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard against a mistake made twice already (Phase 03 finding 11, then
 * again on purchase_receipts): the company-integrity migration gave many
 * parent tables a SECOND foreign key from their children, so an embedded
 * select that does not name its foreign key is ambiguous. PostgREST
 * answers HTTP 300 and the page 500s — at runtime only, which is why no
 * unit or type check caught it.
 *
 * The rule enforced here is deliberately absolute: EVERY embedded table
 * names its foreign key, whether or not that relationship is ambiguous
 * today. A per-relationship allowlist would have to be updated every
 * time a composite foreign key is added — and forgetting to update it is
 * the same failure that caused both outages. Naming the key always costs
 * nothing and cannot go stale.
 */

const SERVICES_DIR = join(process.cwd(), "server", "services");

function serviceFiles(): string[] {
  return readdirSync(SERVICES_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join(SERVICES_DIR, f));
}

/**
 * Embedded tables in a select literal that do not name a foreign key.
 * An embed looks like `table(cols)`, `table!inner(cols)` or
 * `table!some_fkey!inner(cols)`; only the last form is acceptable.
 */
function unhintedEmbeds(source: string): string[] {
  const found: string[] = [];
  const selectCalls = source.matchAll(/\.select\(\s*("(?:[^"\\]|\\.)*")/gs);
  for (const [, literal] of selectCalls) {
    if (!literal) continue;
    for (const [, name, hint] of literal.matchAll(
      /(?:^|[ ,*"])([a-z_][a-z0-9_]*)((?:![a-z0-9_]+)*)\(/g,
    )) {
      if (!name || name === "count") continue;
      const hints = (hint ?? "").split("!").filter(Boolean);
      // `!inner` alone is a modifier, not a foreign-key name.
      const namesForeignKey = hints.some((h) => h !== "inner");
      if (!namesForeignKey) found.push(`${name} in ${literal.slice(0, 70)}`);
    }
  }
  return found;
}

describe("PostgREST embeds name their foreign key", () => {
  it("finds no unhinted embed of an ambiguous relationship", () => {
    const offenders: string[] = [];
    for (const file of serviceFiles()) {
      const source = readFileSync(file, "utf8");
      for (const embed of unhintedEmbeds(source)) {
        offenders.push(`${file.split("/").pop()}: ${embed}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("recognises a hinted embed as safe and an unhinted one as an offender", () => {
    const safe = `.select("*, suppliers!purchase_orders_supplier_id_fkey!inner(code)")`;
    const unsafe = `.select("*, purchase_receipt_lines(id), purchase_receipts(id)")`;
    expect(unhintedEmbeds(safe)).toEqual([]);
    expect(unhintedEmbeds(unsafe).length).toBeGreaterThan(0);
  });
});
