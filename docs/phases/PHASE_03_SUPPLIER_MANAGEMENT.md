# Phase 03 — Supplier Management

> **Status: Implemented — pending live verification.** Activated by owner
> instruction 2026-08-06 ("move to phase 3"). Defaults chosen at
> activation are recorded as D-019 and may be overridden by the owner.

## Objective

Manage China and Bangladesh suppliers, supplier contacts, private supplier documents, and supplier quotations.

## Business Outcome

All supplier relationships and quotations are recorded, comparable, and confidential costs are restricted and audited.

## Included Scope (delivered)

- Supplier directory per company: code, name, ISO country, capabilities,
  address, notes; archive-only (refused while active quotations exist)
- Supplier contacts: name, role, phone, WeChat/WhatsApp, email;
  archive-only with reasons
- Quotations linked to products/variants: MOQ, lead time, valid-until,
  terms — with **prices split into an RLS-walled costs table**
  (`numeric(14,4)` unit price, ISO currency, `numeric(16,6)` exchange
  rate captured at quote time); price reads audited; price values never
  in audit payloads; creating a quotation requires quotation.manage AND
  cost.view
- Quotation comparison view: all quotes for a product side by side,
  quoted price + normalized price in the company base currency
- Private supplier documents: `supplier-documents` bucket (confidential,
  25 MB, pdf/image/office), registry rows, per-download audit, soft
  delete
- 7 new permissions + default role mappings (manager sees quotations
  without prices; employee directory-only; viewer none) — matrix in
  `modules/suppliers/SUPPLIERS_PERMISSION_MATRIX.md`
- UI: /suppliers (per-company directory + create), /suppliers/[id]
  (edit, contacts, quotations with `•••` price masking, documents),
  /suppliers/compare — permission-aware throughout; main-nav entry
- Module documentation set

## Excluded Scope (respected)

Purchase requests/orders and samples (Phase 04), supplier payments
(Phase 12), supplier portals/external access.

## Dependencies

Phases 01–02 complete (quotations attach to catalog products).

## Database Changes

Migrations `20260806120001_supplier_management` (5 tables, 9 indexes,
4 triggers, client-write revocation, permission-gated RLS) and
`20260806120002_supplier_reference_data` (bucket, 7 permissions, role
mappings). Applied to staging 2026-08-06. Production untouched.

## Permission Requirements

`suppliers.view/manage`, `suppliers.quotation.view/cost.view/manage`,
`suppliers.document.download/manage` — full server-side checks via the
Phase 01 evaluator; RLS parity per table (suppliers by view; quotations
by quotation.view; costs by cost.view; documents by document.download).

## Audit Requirements

11 event types in `modules/suppliers/SUPPLIERS_AUDIT_EVENTS.md`,
including `quotation.cost_viewed` on every price exposure; plus storage
events per document object.

## File-Storage Requirements

`supplier-documents`: private, confidential class, 25 MB cap,
pdf/image/office allow-list, 300-second signed URLs, per-download audit.

## Validation Rules

Zod everywhere; prices/rates as decimal strings (4/6 dp) — never floats;
ISO country/currency codes; whole-number MOQ/lead-time; ISO dates;
cross-company re-validation of every client-supplied ID.

## Approval Rules

None beyond mandatory reasons on archival (audited). Purchase approvals
arrive with Phase 04.

## Error Handling

Typed ServiceErrors; duplicate supplier code → conflict; archived
targets → conflict; cross-company references → invalid_input; quotation
insert is compensated (metadata row removed) if the cost row fails.

## Security Requirements

Prices and documents are Confidential class. The cost table is the
enforced wall (verified by staging probe: employee sees 0 cost rows);
deny-all client writes on all 5 tables; no price values in audit
payloads or error messages.

## Testing Requirements

10 new unit tests (57 total, all passing); staging RLS probe with
recorded evidence below; live manual script in
`modules/suppliers/SUPPLIERS_TEST_PLAN.md`.

## Migration Plan

Applied dev→staging (files committed). Production only via the
owner-gated deployment plan.

## Rollback Plan

Drop the 5 tables in dependency order; delete the bucket if empty;
delete seeded permission/mapping rows by key. App rollback via previous
Vercel build.

## Deliverables

Implemented scope, module documentation set, cross-cutting doc updates
(permission matrix, audit catalog, storage policy, decision log D-019),
verification evidence, this report.

## Completion Criteria

| Criterion | Verdict | Evidence |
|---|---|---|
| Approved scope implemented | Pass | This document + code tree |
| Excluded scope untouched | Pass | No PO/sample/payment tables or routes |
| Migrations pass against staging | Pass | 2/2 applied 2026-08-06 |
| Permissions enforced server-side | Pass | Every service path behind requirePermission; company re-validation on all client IDs |
| Price wall enforced at DB boundary | Pass | Probe: employee sees supplier (1) but 0 quotations / 0 cost rows / 0 documents; insert denied 42501 |
| Quotation prices absent from audit | Pass | `quotation.created` payload carries currency/terms only; cost reads audited value-free |
| Unit tests pass | Pass | 57/57 (10 new) |
| Lint / typecheck / build pass | Pass | 0 errors; 3 new routes present |
| Advisors reviewed | Pass | No new findings after 5-table DDL |
| Adversarial review executed | Pass | 3 independent reviewers (authorization/price-leakage, database/RLS, correctness); 10 findings verified and fixed, 2 recorded as accepted risks — see Review Findings |
| Documentation updated | Pass | Module set + cross-cutting docs + D-019 |
| Production untouched | Pass | No operations against pbyjyamqmbotixahkknu |
| Live manual verification (owner) | **Pending** | Script in SUPPLIERS_TEST_PLAN.md |

## Open Questions

Owner may override D-019 defaults (code convention, country list in the
create form, manager price access, document size/type limits).

## Risks

Comparison normalization uses the rate captured at quote time — this is
by design (historical accuracy) but means stale quotes show stale
conversions; validity dates are displayed to compensate.

## Implementation Checklist

- [x] Activation approved by owner ("move to phase 3", 2026-08-06)
- [x] Full specification (module docs) authored
- [x] Migrations + reference data applied to staging
- [x] Services, actions, UI implemented
- [x] Unit tests + staging RLS verification
- [ ] Live manual verification (owner)
- [ ] Completion declaration

## Verification Evidence

2026-08-06, staging project `yhrdyyvayistqqwxawqr`:

```
lint:        0 errors, 0 warnings
typecheck:   clean (strict)
unit tests:  57 passed / 57 (6 files; 10 new supplier tests)
build:       production build OK — /suppliers, /suppliers/[id],
             /suppliers/compare routes present
migrations:  20260806120001, 20260806120002 applied
advisors:    no new findings after 5-table DDL

RLS probe (fixtures inserted + probed + rolled back; residue 0):
  administrator: suppliers 1, quotations 1, costs 1
  employee (suppliers.view only):
    suppliers visible: 1        quotations: 0
    supplier_quotation_costs: 0 (PRICE WALL)
    supplier_documents: 0
    INSERT suppliers: denied SQLSTATE 42501
production:  untouched
```

## Review Findings (3 independent reviewers, 2026-08-06)

Fixed before live verification (all deployed):

1. **Company-integrity gap (database reviewer)** — child rows carried
   their own `company_id` unconstrained against their parent's company,
   so a hypothetical server bug mis-stamping a company could re-scope
   confidential rows across tenants with RLS none the wiser. Fixed for
   ALL phases: migration `20260806130001` adds `unique (id, company_id)`
   parent keys and composite FKs across the organization, product, and
   supplier domains (plus variant→product pinning). Negative probe
   confirms a mis-stamped cost row is now rejected by FK.
2. **Audited-read bypass (authorization reviewer)** — cost-permission
   holders could SELECT `supplier_quotation_costs` (and
   `product_intelligence`) directly via the browser client, reading
   confidential values with zero audit events. Fixed: migration
   `20260806130002` makes both tables RLS deny-all (server-only, like
   audit_log); every read now flows through the audited services.
   Probe: administrator client-side sees 0 rows in both tables.
3. **Permission-check ordering in createQuotation** — relationship and
   status errors were emitted before requirePermission (metadata oracle
   for holders of leaked UUIDs). Authorization now runs first.
4. **Quotation-count disclosure** — the archive-refusal message exposed
   exact active-quotation counts to users who may lack quotation.view;
   count removed from the message.
5. **Float misranking on the comparison surface (correctness reviewer)**
   — `(price * rate).toFixed(2)` produced e.g. 2.675 → "2.67";
   normalized prices are now computed with exact BigInt decimal math
   (half-up), and tiny positive prices render at 4 dp instead of "0.00".
6. **Unchecked compensating delete** — a failed cost insert whose
   cleanup also failed left a silent orphan quotation; cleanup failures
   are now logged and audited (`quotation.orphan_cleanup_failed`).
7. **Archive/creation race** — a supplier could be archived between the
   status check and the quotation insert; createQuotation now re-checks
   after insert and undoes itself if the supplier was archived.
8. **Impossible dates + integer overflow** — `2026-02-31` and
   10-digit MOQs passed validation and surfaced as generic 500s; the
   schema now enforces real calendar dates, MOQ ≤ 1e8, lead ≤ 3650 days.
9. **Compare-page crashes** — malformed or foreign product ids crashed
   the page; they now render a friendly notice, and supplier pages
   degrade gracefully for roles lacking `products.view`.
10. **Irrecoverable document rows** — removal deleted the object before
    the registry row, which could strand an active row forever; the
    order is reversed with restore-on-failure.

Regression found during live verification (2026-08-06, fixed):

11. **Ambiguous PostgREST embeds caused by finding 1.** The composite
    company-integrity FKs gave every parent table a second relationship
    path, so unhinted resource embeds became ambiguous and PostgREST
    answered HTTP 300 — the supplier detail page returned 500. Evidence:
    staging API log shows `GET /rest/v1/supplier_quotations?select=*,
    suppliers!inner(code,name),...` → 300 while every other request in
    the same page load returned 200. Fixed by naming the intended
    foreign key in all nine affected embeds (supplier quotations,
    quotation/contact archival, supplier documents, variant status,
    variant attribute values, product images).

Accepted risks (recorded, not fixed):

- **Existence oracle via fetch-before-authorize** (systemic, Phases
  01–03): services can reveal that a UUID exists before authorization
  denies. UUIDs are unguessable 122-bit values, so exploitation requires
  already-leaked identifiers; full re-ordering across every service is
  deferred to a hardening pass. The richest instance (createQuotation)
  is fixed.
- **Duplicate quotations on double-submit**: no uniqueness over
  (supplier, product, variant) — genuinely repeated quotes are
  legitimate business data; duplicates are visible and archivable.
- **Signed-URL issuance is audited as `file.downloaded` on render**,
  i.e. the trail records access grants, not confirmed downloads —
  consistent across Phases 01–03 and noted in the audit catalog.

## Final Phase Verdict

**Implemented — pending live verification.** All code-, schema-,
security-, review-, and test-level criteria pass with evidence
(63 unit tests after review fixes). Remaining: owner-side live manual
script (SUPPLIERS_TEST_PLAN.md) against the deployed app, then the
completion declaration.
