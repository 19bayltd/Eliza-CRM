# Phase 02 — Product Master

> **Status: Implemented — pending live verification.** Activated by owner
> instruction 2026-08-05 (D-016). Defaults chosen at activation are
> recorded as D-017 and may be overridden by the owner.

## Objective

Create the product master: products, variants, categories, attributes, internal SKUs, and confidential product intelligence, as the single product source of truth.

## Business Outcome

Every product and variant exists once, with unique per-company SKUs, controlled statuses, and confidential sourcing data visible only to authorized users.

## Included Scope (delivered)

- Units, nested categories, attributes + values — per company,
  archive-only, reference-protected archiving
- Products: per-company unique SKU (`^[A-Z0-9][A-Z0-9-]*$`), name,
  description, category, unit; status machine draft → active → archived
  → active with mandatory reasons
- Variants: own per-company unique SKU, one value per attribute,
  attribute-combination uniqueness within the product (service-enforced);
  archived with their product; cannot reactivate under an archived product
- Confidential product intelligence (sourcing notes, `numeric(14,2)`
  target cost + ISO currency, remarks): separate RLS-walled table;
  reads audited (`product.intelligence_viewed`); writes require
  `products.update` + `products.intelligence.view`; values never copied
  into the audit log
- Product images: `public-product-images` / `confidential-product-images`
  buckets (both PRIVATE; 300s signed URLs; per-bucket permissions;
  every download audited); registry rows tie objects to
  products/variants with tier rules
- CSV import per master pipeline: validate (stored per-row plan,
  nothing written) → apply (row-by-row with recorded failures) /
  discard; ≤2000 rows; jobs + row outcomes permanently stored
- 8 new permissions + default role mappings (owner/admin full; manager
  operate-no-confidential; employee/viewer read) — matrix in
  `modules/products/PRODUCTS_PERMISSION_MATRIX.md`
- UI: /products (per-company lists + create), /products/[id] (edit,
  status, variants, images, intelligence panel), /products/catalog,
  /products/import — permission-aware, loading/empty/error states,
  confirmations on destructive actions
- Module documentation set (spec, workflow, permission matrix, audit
  events, test plan)

## Excluded Scope (respected)

Supplier linkage (Phase 03), pricing/costing engines (Phases 04/12),
inventory balances (Phase 05), barcodes (Phase 06), attribute values via
CSV, open-web product images (storefront phases).

## Dependencies

Phase 01 complete (declared 2026-08-05; all criteria evidence-backed).

## Database Changes

Migrations `20260805110001_product_master` (11 tables, 22 indexes, 7
updated_at triggers, client-write revocation, RLS policies) and
`20260805110002_product_reference_data` (2 buckets, 8 permissions, role
mappings). Applied to staging 2026-08-05. Production untouched.

## Permission Requirements

`products.view/create/update/archive`, `products.catalog.manage`,
`products.intelligence.view`, `products.import`, `products.export` —
full server-side check via the Phase 01 evaluator; RLS parity at the
database boundary (intelligence/import tables gated by
`app.has_permission`).

## Audit Requirements

19 event types registered in `modules/products/PRODUCTS_AUDIT_EVENTS.md`
— lifecycle, confidential access (reads included), import job events;
plus Phase 01 storage events for every image object.

## File-Storage Requirements

Both buckets private; classification internal/confidential; image/* only;
10 MB cap; 300-second signed URLs; company-scoped object paths.

## Validation Rules

Zod at every boundary (SKU/code/name/cost/currency/CSV); every
client-supplied ID re-validated against the target company server-side;
costs as decimal strings, never floats.

## Approval Rules

No approval-gated actions in this phase beyond reasons on
activation/archival (recorded in audit). Approval-record machinery
arrives with purchasing (Phase 04).

## Error Handling

Typed ServiceErrors; unique violations → human-readable conflicts;
archived targets → conflicts; cross-company references → invalid_input;
import row failures recorded per row, never silent.

## Security Requirements

Data classification: intelligence + confidential images = Confidential;
products/catalog = Internal. RLS on all 11 tables; deny-all client
writes; confidential wall verified by staging probe (employee sees 0
intelligence rows); no confidential values in audit payloads.

## Testing Requirements

19 new unit tests (47 total, all passing); staging RLS probe executed
with recorded evidence (see Verification Evidence); live manual script in
`modules/products/PRODUCTS_TEST_PLAN.md`.

## Migration Plan

Applied dev→staging (same migration files committed to the repo).
Production application only via the owner-gated deployment plan.

## Rollback Plan

Compensating rollback documented in each migration header (drop the 11
tables in dependency order; delete buckets if empty; delete seeded
permission/mapping rows by key). App rollback via previous Vercel build.

## Deliverables

Implemented scope (36 files), module documentation set, updated
cross-cutting docs (permission matrix, audit catalog, storage policy,
decision log D-016/D-017), verification evidence below, this report.

## Completion Criteria

| Criterion | Verdict | Evidence |
|---|---|---|
| Approved scope implemented | Pass | This document + code tree |
| Excluded scope untouched | Pass | No supplier/pricing/inventory/barcode tables or routes |
| Migrations pass against staging | Pass | 2/2 applied 2026-08-05; `list_migrations` |
| Permissions enforced server-side | Pass | Every service path behind requirePermission; company re-validation on all client IDs |
| Permissions enforced at DB boundary | Pass | Staging RLS probe (below) |
| Cross-company isolation | Pass | Probe: employee scoped to ELIZA_SOURCE sees 0 of 19BAY fixture |
| Confidential wall | Pass | Probe: employee sees 0 intelligence rows; write revocation 42501 |
| Audit events implemented | Pass | 19 event types; intelligence reads audited; no confidential values in payloads |
| Unit tests pass | Pass | 47/47 (19 new) |
| Lint / typecheck / build pass | Pass | 0 errors; production build green (4 new routes) |
| Advisors reviewed | Pass | No new findings (1 pre-existing INFO by design; 1 pre-existing auth WARN noted to owner) |
| Adversarial review executed | Pass | Review of the full Phase 02 diff (authorization, RLS parity, confidentiality, correctness); 2 defects found and fixed — see Review Findings below |
| Documentation updated | Pass | Module set + cross-cutting docs + decisions |
| Production untouched | Pass | Re-verified 2026-08-05: 0 tables, 0 users |
| Live manual verification (owner) | **Waived by owner (D-018)** | Owner declared completion 2026-08-05 without performing the live script. Staging shows zero products/catalog rows and zero `products` audit events, i.e. the product pages have never been exercised by a human. Script remains in PRODUCTS_TEST_PLAN.md |
| Live e2e against deployment | **Waived by owner (D-018)** | Automated product specs written (`tests/e2e/products.spec.ts`, 5 specs covering catalog → product → duplicate-SKU refusal → variant → intelligence → activate/archive → audit) but never executed against the deployment; the sandbox has no network route to it. One command converts this waiver into evidence |

## Open Questions

Owner may override D-017 defaults (SKU convention, attribute list,
intelligence audience, category depth). Existing product list for
import: not yet provided.

## Risks

No new critical risks registered. Import apply is intentionally
non-transactional per row (failures recorded, no silent partials) —
acceptable for ≤2000-row catalogs; revisit for larger volumes.

## Implementation Checklist

- [x] Activation approved by owner (D-016)
- [x] Full specification (module docs) authored
- [x] Migrations + reference data applied to staging
- [x] Services, actions, UI implemented
- [x] Tests + staging RLS verification
- [x] Adversarial review (2 defects found and fixed)
- [x] Automated product e2e specs written
- [ ] Live verification — **waived by owner (D-018)**, not performed
- [x] Completion declared by owner 2026-08-05

## Verification Evidence

2026-08-05, staging project `yhrdyyvayistqqwxawqr`:

```
lint:        0 errors, 0 warnings
typecheck:   clean (strict)
unit tests:  47 passed / 47 (5 files; 19 new product tests)
build:       production build OK — /products, /products/[id],
             /products/catalog, /products/import routes present
migrations:  20260805110001, 20260805110002 applied
advisors:    no new findings after 11-table DDL

RLS probe (fixtures inserted + probed + rolled back; residue 0):
  administrator (global, all scopes):
    products visible: 2/2 (both companies)   intelligence: 2/2   import jobs: 1/1
  fixture employee (ELIZA_SOURCE scope, products.view only):
    products visible: 1 (ELIZA_SOURCE only)  19BAY product: 0
    product_intelligence: 0 (confidential wall)
    import_jobs: 0
    INSERT products: denied SQLSTATE 42501
production:  0 tables, 0 users (re-verified)
```

## Review Findings (2026-08-05, post-implementation review)

The Phase 02 diff was reviewed across authorization, RLS parity,
confidentiality, and correctness. Two defects were found and fixed; the
rest of the surface verified clean.

**Fixed — F-1: CSV import could add variants to an archived product.**
`applyImport`'s `create_variant` branch selected only the product `id`
and never checked `status`, so a row naming an archived product created
a live variant under it — a state the interactive path explicitly
refuses ("Archived products cannot receive new variants"). Fixed by
checking status at apply time and recording a per-row failure
(`product <sku> is archived`).

**Fixed — F-2: the two variant-creation paths disagreed on
attribute-less variants.** The interactive path treated the empty
attribute set as a "combination" and refused a second attribute-less
variant, while CSV import (which never assigns attributes) created many.
Applying the strict reading to import would have broken multi-variant
import entirely, so the rule was corrected in the coherent direction:
uniqueness applies to non-empty combinations, and attribute-less
variants are distinguished by their already-unique SKU. Specification
updated to match.

**Verified clean.** Every product service re-validates client-supplied
IDs (category, unit, attribute value, variant, parent category) against
the target company before use, and no service-role query runs before its
`requirePermission` gate. Signed URLs derive their bucket from stored
file metadata rather than client input, so a confidential image cannot
be requested through a public-tier path; the download gate for
`confidential-product-images` is `products.intelligence.view`, making
`listProductImages` fail closed even if its own filter were wrong.
Confidential values never enter audit payloads (field names only), and
the intelligence panel is absent — not merely hidden — without the
permission. RLS policies mirror the service checks and were confirmed by
the staging probe. Category cycles are impossible in this phase (parent
is set only at creation, and self-parenting is blocked by constraint).

Note recorded for a later phase: import applies row-by-row without a
surrounding transaction, by design (per-row failures are recorded rather
than rolling back the batch); revisit if catalogs outgrow the 2000-row
limit.

## Final Phase Verdict

**Phase 02 Complete in Staging** — declared 2026-08-05 by owner
instruction (D-018). Every code-, schema-, security-, review-, and
test-level criterion passes with recorded evidence. Two criteria are
**owner-waived rather than passed**: live manual verification and the
live e2e run. Neither has been performed — staging holds zero products
and zero `products` audit events, so the product pages are unproven
against a real browser.

Residual risk of the waiver: schema, permissions, RLS, and business
logic are verified (database probes, 47 unit tests, adversarial review),
but page rendering, form wiring, and server-action round-trips on the
deployed app are not. A single command closes that gap:

```
BASE_URL=https://eliza-crm.vercel.app \
E2E_USER_EMAIL=<admin account> E2E_USER_PASSWORD=<password> \
npm run test:e2e
```

Evidence from that run (or the manual script in
`modules/products/PRODUCTS_TEST_PLAN.md`) will be appended here and the
waiver retired, exactly as the Phase 01 waiver (D-015) was.
