# Products Module — Test Plan

## Unit (automated, `tests/unit/products-validation.test.ts` — 19 tests)

- SKU schema: accepts/uppercases/limits/rejects
- Status machine: exactly draft→active, active→archived, archived→active
- CSV parser: quoting, escaped quotes, CRLF, blank lines
- Import planner: create/variant/update paths; rejects for invalid SKU,
  missing name, unknown category, existing/duplicate variant SKU,
  duplicate product row, column-count mismatch

## Staging RLS probes (executed 2026-08-05, recorded in phase doc)

- Administrator (global role, all scopes): sees fixture products in both
  companies, intelligence rows, import jobs
- Fixture employee (ELIZA_SOURCE only, `products.view` only):
  - sees ONLY the ELIZA_SOURCE fixture product (cross-company = 0)
  - `product_intelligence`: 0 rows (confidential wall)
  - `import_jobs`: 0 rows
  - INSERT into products: denied 42501 (client writes revoked)
- Fixtures fully rolled back (0 residue verified)

## Live manual script (owner-side, per completion checklist)

1. Catalog setup: unit + category (+ child) + attribute with values
2. Product create (duplicate SKU must be refused with a clear message)
3. Variant add (duplicate attribute combination must be refused)
4. Draft invisibility → activate with reason → audit entries visible
5. Image upload public/confidential; confidential invisible to a
   non-intelligence user; downloads audited
6. Intelligence panel: save + view as intelligence holder; panel absent
   for others; `product.intelligence_viewed` events in audit log
7. CSV import: validate template file → review plan incl. a deliberate
   bad row → apply → products appear; job history correct
8. Archive product → variants archived; archived product not editable;
   reactivate
9. Cross-company: user scoped to one company must not see the other's
   products
