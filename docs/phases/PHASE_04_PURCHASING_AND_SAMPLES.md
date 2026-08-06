# Phase 04 — Purchasing and Samples

> **Status: Implemented — pending live verification.** Activated by owner
> instruction 2026-08-06 ("go on"). Defaults chosen at activation are
> recorded as D-021 and may be overridden by the owner.

## Objective

Implement purchase requests, purchase orders, sample requests/evaluations, and purchase receiving.

## Business Outcome

Purchasing runs through controlled, approvable workflows; receiving atomically records accepted/damaged/missing/extra quantities.

## Included Scope (delivered)

- **Purchase requests** with lines (product/variant, whole-number
  quantity, estimated unit price in base currency), numbered
  `PR-YYYY-####` per company, and a **total frozen at submission** so an
  approver always decides against the amount they were shown
- **Configurable approval engine** — requirements are rows in
  `approval_rules` (company, action, `min_amount`, `required_permission`),
  highest matching tier wins, boundary escalates at `>=`; every decision
  writes an `approval_records` row in the master shape; **self-approval
  is refused server-side regardless of permissions held**, and the
  attempt is audited
- **Purchase orders** numbered `PO-YYYY-####`, raised against a supplier
  and optionally an approved request, with **prices in the RLS deny-all
  `purchase_order_line_costs` table** read only through the audited
  service; issuing freezes the exchange rate and closes the request out
- **Atomic receiving** — one SECURITY DEFINER transaction writes the
  receipt header (`GRN-YYYY-####`), every line, and the resulting order
  status; over-receipt beyond the outstanding quantity is forced into
  `extra` rather than inflating `accepted`
- **Samples** — request → dispatch → receive → evaluate, strictly
  ordered, with outcome and mandatory notes
- **Documents** — `purchase-documents` (confidential) and `sample-photos`
  (internal) buckets with registry rows, audited downloads, soft delete
- 12 permissions + default role mappings; module documentation set

## Excluded Scope (respected)

Inventory ledger postings (Phase 05 — the receipt function is the
designated insertion point), supplier invoicing and payments (Phase 12),
everything belonging to later phases.

## Dependencies

Phases 01–03 complete. Receiving records quantities **without** ledger
postings because Phase 05 is not active; this dependency is flagged here
and in `PURCHASING_SPEC.md` §5.

## Database Changes

Migrations `20260806140001_purchasing_and_samples` (12 tables, 20
indexes, 7 triggers, client-write revocation, permission-gated RLS),
`20260806140002_purchasing_functions` (numbering + atomic receiving),
`20260806140003_purchasing_reference_data` (2 buckets, 12 permissions,
role mappings, seeded approval thresholds), plus hardening migrations
`20260806140004` (execute revoked from PUBLIC) and `20260806140005`
(over-receipt split). Applied to staging 2026-08-06. Production
untouched.

## Permission Requirements

12 `purchasing.*` keys enforced server-side via the Phase 01 evaluator,
with RLS parity per table. Matrix in
`modules/purchasing/PURCHASING_PERMISSION_MATRIX.md`. Combination rules:
issuing an order requires `order.manage` **and** `cost.view`; receiving
requires `receive` **and** `order.view`; approving requires whichever
permission the matching approval rule names.

## Audit Requirements

21 event types in `modules/purchasing/PURCHASING_AUDIT_EVENTS.md`,
including `purchase_order.cost_viewed` (counts only),
`purchase_request.self_approval_refused` (result=failure), and
`purchase_receipt.discrepancy` carrying the damaged/missing/extra
quantities. No price, rate, or total value appears in any payload.

## File-Storage Requirements

`purchase-documents`: private, confidential, 25 MB, pdf/image/office.
`sample-photos`: private, internal, 10 MB, images. Both 300-second
signed URLs with per-download audit.

## Validation Rules

Zod at every boundary; quantities whole and bounded; money as decimal
strings summed with exact integer arithmetic (`sumLineTotals`); approval
thresholds compared with `compareDecimalStrings`, never via `Number`;
real calendar dates; every client-supplied id re-validated against the
acting company.

## Approval Rules

Purchase-request approval is the first consumer of the engine. Seeded
tiers per company: `>= 0` → `purchasing.request.approve`; `>= 500,000`
base-currency units → `purchasing.request.approve.high`. A request whose
amount matches **no** rule is refused rather than falling back to a
default permission, and a rule naming an unknown permission key fails
closed.

## Error Handling

Typed ServiceErrors; wrong status → conflict; cross-company references →
invalid_input; self-approval → forbidden (audited); receipt failures
surface the reason without leaking database internals; a failed cost
insert compensates by deleting its line, and a failed compensation is
itself audited.

## Security Requirements

Order prices and purchase documents are Confidential. The cost table is
the enforced wall (RLS deny-all, verified by probe); client writes are
revoked on all 12 tables; both SECURITY DEFINER functions execute only
as `service_role`.

## Testing Requirements

21 new unit tests (85 total, all passing); staging probes recorded
below; live manual script in
`modules/purchasing/PURCHASING_TEST_PLAN.md`.

## Migration Plan

Applied dev→staging (files committed). Production only via the
owner-gated deployment plan.

## Rollback Plan

Drop the 12 tables in the dependency order listed in migration
`20260806140001`; drop both functions; delete the seeded
permission/mapping/approval-rule rows by key; delete the buckets if
empty. App rollback via the previous Vercel build.

## Deliverables

Implemented scope, module documentation set, cross-cutting doc updates
(permission matrix, audit catalog, storage policy, decision log D-021),
verification evidence, this report.

## Completion Criteria

| Criterion | Verdict | Evidence |
|---|---|---|
| Approved scope implemented | Pass | This document + code tree |
| Excluded scope untouched | Pass | No ledger postings, no invoicing/payment tables or routes |
| Migrations pass against staging | Pass | 5/5 applied 2026-08-06 |
| Permissions enforced server-side | Pass | Every service path behind requirePermission; company re-validation on all client ids |
| Approval thresholds are data, not code | Pass | `approval_rules` rows; `selectApprovalRule` unit-tested at the boundary; unknown permission keys fail closed |
| Separation of duties | Pass | Self-approval refused server-side and audited (`self_approval_refused`) |
| Receiving is atomic | Pass | Probe: a receipt whose 2nd line was foreign left 0 headers, 0 lines, order status unchanged |
| Over-receipt never inflates accepted | Pass | Probe: 20 accepted against a 10-unit line stored 10 accepted + 10 extra |
| Price wall enforced at DB boundary | Pass | `purchase_order_line_costs` RLS-enabled with 0 policies (deny-all); reads only via audited service |
| Money arithmetic exact | Pass | `sumLineTotals` BigInt; unit tests cover 0.1+0.2 and the 2.675 half-up case |
| Prices absent from audit | Pass | `cost_viewed` records counts; no price/rate/total in any payload |
| Unit tests pass | Pass | 87/87 (23 new, incl. the embed guard) |
| Lint / typecheck / build pass | Pass | 0 errors, 0 warnings; 5 new routes present |
| Advisors reviewed | Pass | Both new WARNs fixed (see finding 1); remaining INFOs are the intentional deny-all tables |
| Review executed | Pass | Self-review of the diff — 4 findings fixed; **not** the 3-reviewer adversarial process used in Phases 02–03 (see Review Findings) |
| Documentation updated | Pass | Module set + cross-cutting docs + D-021 |
| Production untouched | Pass | No operations against pbyjyamqmbotixahkknu |
| Live manual verification (owner) | **Pending** | Script in PURCHASING_TEST_PLAN.md |

## Open Questions

Owner may override D-021 defaults — in particular the **500,000
base-currency high-approval threshold**, which was chosen without
business input and is the number most likely to be wrong. Also open:
whether Manager should hold `order.manage`, and whether Employee should
see samples at all.

## Risks

- The approval threshold is per company in base currency; companies with
  different base currencies (19BAY and Eliza Source use BDT, 1 & 9 uses
  USD) get the same numeric threshold, which is **not** currency-adjusted.
  Recorded as an open question for the owner.
- Receiving records quantities with no stock effect until Phase 05; until
  then, "received" means "recorded as arrived", not "in stock".

## Implementation Checklist

- [x] Activation approved by owner ("go on", 2026-08-06)
- [x] Full specification (module docs) authored before implementation
- [x] Migrations + reference data applied to staging
- [x] Services, actions, UI implemented
- [x] Unit tests + staging probes
- [ ] Live manual verification (owner)
- [ ] Completion declaration

## Verification Evidence

2026-08-06, staging project `yhrdyyvayistqqwxawqr`:

```
lint:        0 errors, 0 warnings
typecheck:   clean (strict)
unit tests:  87 passed / 87 (8 files; 21 purchasing + 2 embed-guard)
build:       production build OK — /purchasing, /purchasing/orders,
             /purchasing/orders/[id], /purchasing/requests/[id],
             /purchasing/samples present
migrations:  20260806140001-140005 applied
advisors:    2 new WARNs found and fixed (SECURITY DEFINER functions
             executable by anon/authenticated via PUBLIC); after the fix
             only pre-existing INFOs (intentional deny-all tables) and
             the owner-action leaked-password WARN remain

Staging probes (fixtures created, probed, removed; residue 0):
  numbering:     PR-2026-0001, PR-2026-0002, PO-2026-0001 — sequential,
                 no collision; sequences reset after probing
  atomicity:     receipt with a foreign 2nd line -> exception; afterwards
                 receipt headers 0, receipt lines 0, order still 'issued'
                 (the already-inserted 1st line was rolled back too)
  partial:       4 accepted + 1 damaged  -> status 'partially_received'
  completion:    6 accepted + 2 extra    -> status 'received';
                 a further receipt against it was refused
  over-receipt:  20 accepted on a 10-unit line -> 10 accepted, 10 extra,
                 status 'received'
  company FKs:   mis-stamped cost row REJECTED (foreign_key_violation);
                 mis-stamped order line REJECTED
  RLS:           purchase_order_line_costs and document_sequences have
                 RLS enabled with 0 policies (deny-all, server-only);
                 all other purchasing tables have exactly 1 select policy
  role mapping:  owner 12, administrator 12, manager 9, employee 3,
                 viewer 0 purchasing permissions
  residue:       0 after cleanup. NOTE: the first cleanup ran before the
                 over-receipt probe was created, so PO-2026-9002 and its
                 receipt survived and were visible to the owner during
                 live testing; removed 2026-08-06 11:5x. Probe fixtures
                 must be cleaned after the LAST probe, not mid-sequence.
production:      untouched
```

## Review Findings (self-review of the diff, 2026-08-06)

**Process note, stated plainly:** Phases 02 and 03 were reviewed by three
independent adversarial reviewers. This phase was reviewed by the author
(a single self-review pass) plus the Supabase advisors, because
independent-reviewer runs were not available in this session. The
findings below are real and fixed, but the review is weaker evidence than
the earlier phases' — an independent adversarial pass over Phase 04
remains a recommended follow-up before production.

1. **SECURITY DEFINER functions executable by anonymous callers
   (advisors, WARN).** `revoke execute … from anon, authenticated` does
   not remove the default `EXECUTE` grant PostgreSQL gives to `PUBLIC`,
   which those roles inherit. Both functions were reachable through
   `/rest/v1/rpc/…` without signing in — `record_purchase_receipt` would
   have let an anonymous caller write receipts and flip order status,
   bypassing every permission check. Fixed in `20260806140004`: revoked
   from `PUBLIC`, granted to `service_role` only. Advisors re-run clean.
2. **Over-receipt inflated accepted quantities.** The spec says surplus
   is recorded as `extra`; the function trusted the caller's split, so
   entering 20 accepted against a 10-unit line marked the order fully
   received with an accepted count above the ordered quantity. Fixed in
   `20260806140005`: the function computes the outstanding quantity and
   moves any surplus into `extra` before writing.
3. **Any employee could cancel a colleague's request.**
   `purchasing.request.manage` is held by every employee, and
   `cancelRequest` checked only that permission. Now cancellation requires
   being the requester, or holding the approval permission that the
   matching rule names.
4. **Documents were specified but not implemented.** The buckets and
   registry table existed with no service or UI behind them. Added
   `purchase-documents.ts` (upload/list/remove, registry-first removal
   with restore-on-failure, per-download audit) and wired both the order
   page (documents) and the samples page (photos) to it.

5. **The Phase 03 embed mistake, repeated.** The purchase-order page
   500'd as soon as it had a receipt query to run: `purchase_receipts`
   embedded `purchase_receipt_lines` without naming a foreign key, and
   the company-integrity migration had given that pair two FK paths, so
   PostgREST answered HTTP 300. This is exactly finding 11 of Phase 03,
   which I documented and then reproduced. Fixed by naming the key, and
   guarded permanently: `tests/unit/postgrest-embeds.test.ts` fails the
   build if ANY embed in `server/services` omits its foreign key —
   an absolute rule rather than a list of known-ambiguous pairs, because
   such a list needs updating every time a composite FK is added, and
   forgetting to update it is the failure itself. Four further unhinted
   embeds (two variant lookups, three role lookups) were named at the
   same time; none was ambiguous yet.

Accepted risks (recorded, not fixed):

- **Existence oracle via fetch-before-authorize** — systemic across
  Phases 01–04; services can reveal that a UUID exists before
  authorization denies. Exploitation requires already-leaked 122-bit
  identifiers. `createOrder` and `decideRequest` authorize first.
- **No independent adversarial review** for this phase (see process note).
- **Sample photos are Internal, not Confidential** — a photo of a sample
  garment can imply an unreleased design; if that matters, the owner can
  re-classify the bucket.

## Final Phase Verdict

**Implemented — pending live verification.** All code-, schema-,
security-, and test-level criteria pass with evidence: 85 unit tests, 5
migrations, staging probes covering atomicity, over-receipt, company
integrity and the price wall, and advisors clean after two real fixes.
Remaining: the owner-side live manual script
(`modules/purchasing/PURCHASING_TEST_PLAN.md`) against the deployed app,
then the completion declaration. An independent adversarial review is
recommended before this phase reaches production.
