# Eliza OS Implementation Status

## Current Phase

Phase 05 — Inventory and Warehouse (activated by owner instruction
2026-08-06, D-024): **implemented, pending owner live verification**.
Phase 04 closed **Complete in Staging** the same day (D-021 activation,
D-023 completion).

## Current Status

**Phase 05 implemented — pending owner live verification** (see Work in
Progress). The stock ledger is append-only and its balances are derived
from it, both enforced by database triggers rather than by convention;
Phase 04 receiving now posts accepted quantities into the ledger inside
the receipt transaction. Defaults recorded as D-024/D-025.

Phases 00–04 are **Complete in Staging** with all criteria
evidence-backed (Phases 02, 03 and 04 live-verified by owner browser
testing 2026-08-05/06). Production deployment is NOT authorized. Phase 06
must NOT begin without explicit owner authorization.

## Approved Scope (Phase 05)

An append-only stock ledger with derived balances, a database-level
negative-stock block with an audited override, warehouse locations,
two-step transfers, approval-gated adjustments, stock counts, the wiring
that makes Phase 04 receiving post stock atomically, 11 new permissions
with default role mappings, one storage bucket, module documentation,
tests.

## Excluded From Current Work

Barcodes (06), POS, CRM,
orders, HR, finance, reporting, dashboards, alerts, AI. Supplier
payments (12), supplier portals.

## Completed Work

Phase 01 (all items; see `phases/PHASE_01_SECURE_PLATFORM_FOUNDATION.md`):
foundation, auth, organization, permissions, audit, storage, admin area,
live verification 2026-08-01→05, live e2e 5/5, completion + evidence.

Phase 02 (2026-08-05):

- Migrations `20260805110001` (11 product-domain tables, RLS, write
  lockdown) + `20260805110002` (2 image buckets, 8 permissions, role
  mappings) applied to staging; DB types regenerated
- Services: catalog (units/categories/attributes), products (status
  machine, variant combination uniqueness), confidential intelligence
  (audited reads, value-free audit payloads), product images (tiered,
  signed URLs), CSV import (validate/apply/discard with stored per-row
  plan)
- UI: /products, /products/[id], /products/catalog, /products/import +
  main-nav entry — permission-aware throughout
- 19 new unit tests (47 total green); staging RLS probes recorded
  (cross-company isolation, confidential wall, write revocation);
  advisors clean; adversarial review run with 2 defects found and fixed
- Module documentation set + cross-cutting docs updated (permission
  matrix, audit catalog, storage policy, decision log D-016/D-017)

Phase 03 (2026-08-06):

- Migrations `20260806120001` (5 supplier tables, permission-gated RLS,
  write lockdown) + `20260806120002` (supplier-documents bucket, 7
  permissions, role mappings); hardening migrations `20260806130001`
  (composite company-integrity FKs across all phases) and
  `20260806130002` (cost/intelligence tables server-only)
- Services: suppliers, contacts, quotations with an RLS-walled cost
  table (exact decimal normalization, audited price reads), comparison,
  private documents
- UI: /suppliers, /suppliers/[id], /suppliers/compare + nav entry
- 17 supplier unit tests (64 total green); staging RLS probes; three
  independent adversarial reviewers — 12 findings fixed, 3 accepted
  risks recorded
- Owner live verification 9/9, each check confirmed against the database
- Module documentation set + cross-cutting docs (permission matrix,
  audit catalog, storage policy, D-019)

Phase 04 (2026-08-06):

- Migrations `20260806140001` (12 purchasing tables, composite company
  FKs, permission-gated RLS, write lockdown), `20260806140002`
  (numbering + atomic receiving functions), `20260806140003` (2 buckets,
  12 permissions, role mappings, seeded approval thresholds), plus
  hardening `20260806140004` (execute revoked from PUBLIC) and
  `20260806140005` (over-receipt split)
- Services: purchase requests with a submission-frozen total, the
  approval engine (thresholds as data, self-approval refused), purchase
  orders with an RLS deny-all cost table, atomic receiving, samples,
  purchase documents and sample photos
- UI: /purchasing, /purchasing/requests/[id], /purchasing/orders,
  /purchasing/orders/[id], /purchasing/samples + nav entry
- 21 purchasing unit tests plus a guard that fails the build on any
  PostgREST embed missing its foreign key (87 total green)
- Owner live verification 9/9 by two real users, each confirmed against
  the database; 5 self-review/advisor findings fixed
- Module documentation set + cross-cutting docs (permission matrix,
  audit catalog, storage policy, module roadmap, risk register R-013→
  R-016, D-021/D-022/D-023) and the four audit logs — code, database,
  security, release — which had gone unupdated since Phase 01 and were
  backfilled for Phases 02–04 on 2026-08-06

Phase 05 (2026-08-06):

- Migrations `20260806150001`–`150010`: warehouses become a
  company-integrity parent; 10 inventory tables; ledger immutability and
  derived balances; nullable-variant balance key; reference data; batch
  posting plus the Phase 04 receipt hook and `purchase_orders.warehouse_id`;
  TRF/ADJ/CNT numbering; the balance write guard; pinned search_paths;
  the constraint that an issued order must name a destination warehouse
- Services: balances and ledger history, manual movements, warehouse
  locations, two-step transfers, approval-gated adjustments reusing the
  Phase 04 engine, stock counts with snapshot-and-variance
- UI: /inventory, /inventory/ledger, /inventory/transfers(+[id]),
  /inventory/adjustments(+[id]), /inventory/counts(+[id]) + nav entry
- 20 inventory unit tests plus 10 pinning the purchase-order
  destination rule (117 total green); staging probes covering
  immutability, derivation, the negative floor, the override, sign
  constraints, atomic receipt posting and reconciliation
- 5 self-review/advisor findings fixed; all 16 inventory embed hints plus
  the new order-destination embed verified against `pg_constraint`
  (purchase_orders reaches warehouses by two foreign keys, so the unhinted
  form would have returned HTTP 300). Finding 5 is the one that reached
  the owner:
  this phase broke Phase 04 order creation by requiring a destination
  warehouse at draft time when staging has no warehouses. Reverted and
  redone with the rule at issue time and enforced by a check constraint
- Module documentation set + cross-cutting docs + the four audit logs +
  D-024, R-017/R-018

## Work in Progress

**Phase 05 implemented — pending owner live verification.** The script is
in `modules/inventory/INVENTORY_TEST_PLAN.md` and is **blocked until at
least one warehouse exists**: staging currently has none, and warehouse
creation is Phase 01 functionality (Administration → Organization) that
implementation deliberately does not seed. Note this phase again had a
**self-review** rather than independent adversarial reviewers.

## Blocked Work

- Production deployment — needs owner approval of
  `releases/PHASE_01_PRODUCTION_DEPLOYMENT_PLAN.md` (now would include
  Phase 02 + 03 + 04 migrations)
- Independent adversarial review of the Phase 04 and Phase 05 diffs —
  recommended before either reaches production
- **No warehouses exist in staging**, so inventory cannot be exercised
  until the owner creates at least one per company in Administration →
  Organization

## Post-Completion Follow-ups

- ~~Retire the Phase 02 waiver (D-018)~~ — DONE 2026-08-06 via owner
  browser testing (evidence in the phase document)
- Staging test-data cleanup before real catalog data: archive the
  E2E-/test units, categories, attributes (incl. the attribute named
  "M"), and test products; fix crossed variant SKU/size labels; also
  the Phase 03 verification data (suppliers SUP-BD-001/002, their
  contacts and three archived quotations)
- Jony (`admanager.1and9@gmail.com`) currently holds Employee in Eliza
  Source after the Manager/Employee role swap used for checks 5–6 —
  confirm that is the intended standing role

- Administrator test account (nkfhhdndjdh@gmail.com) password rotation —
  operator agreed to change it (displayed during e2e testing)
- Supabase Auth "leaked password protection" (HaveIBeenPwned check) is
  disabled — dashboard toggle recommended (Authentication → Attack
  Protection), owner action

## Open Decisions

- Owner ratification or override of Phase 02/03/04 defaults (D-017,
  D-019, D-021) — in particular the 500,000 high-approval threshold,
  which was chosen without business input and is not currency-adjusted
  across companies with different base currencies
- Owner approval to execute the production deployment plan
- Phase 06 activation (do not start without it)
- Whether Viewer should see stock quantities (D-024 says yes) and whether
  a dispatched transfer should be cancellable (currently no)

## Test Status

Unit 117/117 pass (9 files; 20 Phase 05 inventory tests, 31 Phase 04
purchasing tests, plus a guard that fails the build on any PostgREST
embed missing its foreign key). Integration
suite env-gated. E2E: 5/5 green against the live deployment (Phase 01
scope); Phases 02 and 03 verified by owner browser testing (Phase 03:
9/9 checks, 2026-08-06). Staging SQL verification: Phase 01/02/03 probes
all passed with recorded evidence (phase docs — Phase 03 adds the
quotation price-wall probe and the live audit-log price scan, 0 rows;
Phase 04 adds receiving-atomicity, over-receipt, company-integrity and
deny-all probes).

## Security Audit Status

Phase 01 review complete — no critical findings. Phase 02: advisors
report no new findings (1 pre-existing INFO: audit_log deny-all by
design; 1 pre-existing WARN: leaked-password protection disabled —
owner dashboard action recommended). Adversarial review of the Phase 02
diff (authorization, RLS parity, confidentiality, correctness) found and
fixed two defects — CSV import could add variants to an archived
product, and the two variant-creation paths disagreed on attribute-less
variants. Both fixed and documented in the phase document under Review
Findings.

Phase 03: three independent adversarial reviewers (authorization/price
leakage, database/RLS, correctness) produced 12 fixed findings and 3
recorded accepted risks. The two structural ones were a client-side
read path into the confidential cost and intelligence tables (both now
RLS deny-all, server-only) and unconstrained child `company_id` values
(now enforced by composite `(id, company_id)` foreign keys across the
organization, product, and supplier domains). Live verification then
confirmed the price wall behaviourally: the Manager account produced no
`quotation.cost_viewed` events, and an audit-log scan for price values
across all modules returned 0 rows.

Phase 04: reviewed by the author (single self-review pass) plus the
Supabase advisors — NOT by independent adversarial reviewers, unlike
Phases 02–03. Four findings fixed, the most serious being that both
SECURITY DEFINER functions were callable by anonymous users through
/rest/v1/rpc because revoking EXECUTE from anon/authenticated does not
remove PostgreSQL's default grant to PUBLIC; `record_purchase_receipt`
would have let an unauthenticated caller write receipts and change order
status. Fixed by revoking from PUBLIC and granting only to service_role;
advisors re-run clean. An independent adversarial pass over Phase 04 is
recommended before production.

## Migration Status

Staging: 28/28 applied (7 Phase 01 + 2 Phase 02 + 2+2 Phase 03 + 3+2
Phase 04 + 10 Phase 05) + seed.
Production: none (by design; gated plan prepared).

## Deployment Status

Staging app live at https://eliza-crm.vercel.app (auto-deploys from
`main`), connected to `eliza-source-crm-staging` only. Production
Supabase untouched (re-verified 2026-08-05: zero tables, zero users).
Production deployment not authorized.

## Phase Completion Verdict

Phases 00–03: **Complete in Staging**, all criteria evidence-backed
(D-015/D-018 waivers retired by evidence; Phase 03 carries no waiver —
every criterion including live manual verification passed on evidence).
Criteria tables in the respective phase documents. Phase 05:
**Implemented — pending owner live verification** under D-024.
