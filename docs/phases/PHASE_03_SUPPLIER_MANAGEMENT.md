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

## Final Phase Verdict

**Implemented — pending live verification.** All code-, schema-,
security-, and test-level criteria pass with evidence. Remaining:
owner-side live manual script (SUPPLIERS_TEST_PLAN.md) against the
deployed app, then the completion declaration.
