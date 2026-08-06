# Phase 05 — Inventory and Warehouse

> **Status: Implemented — pending live verification.** Activated by owner
> instruction 2026-08-06 ("move to phase 5"). Design decisions are
> recorded as D-024 and may be overridden by the owner. Production
> deployment remains unauthorized.

## Objective

Implement the immutable stock ledger, warehouse operations, transfers, adjustments, and stock counts.

## Business Outcome

Stock balances are trustworthy: every movement is a ledger transaction; negative stock is blocked; adjustments require approval.

## Included Scope (delivered)

- **Append-only `stock_ledger`** — UPDATE and DELETE raise in a trigger
  *and* are revoked from client roles. There is no interface, service or
  script that can alter history; corrections are compensating entries.
- **Derived `stock_balances`** — written by exactly one thing, the ledger
  trigger, now enforced by a guard trigger that refuses every other
  write. The balance for any (warehouse, product, variant) is the sum of
  its ledger entries, and a probe asserts it.
- **Negative-stock block in the database**, not in a service, so it holds
  for every future phase's postings. The override is a separately-held
  permission, scoped to one transaction, and audits its own use.
- **All twelve transaction types** from `DATABASE_ARCHITECTURE.md` §5
  exist now, each with a sign constraint; types no implemented path posts
  are refused by validation so a later phase's flow cannot start early.
- **Two-step transfers** (`TRF-YYYY-####`): dispatch posts `transfer_out`,
  receipt posts `transfer_in`, and goods in transit belong to neither
  warehouse — which the page says out loud.
- **Approval-gated adjustments** (`ADJ-YYYY-####`) reusing the Phase 04
  engine, with approve-and-post as one guarded step and self-approval
  refused server-side.
- **Stock counts** (`CNT-YYYY-####`) that snapshot system quantities at
  open and post only non-zero variances.
- **Phase 04 receiving wired into the ledger**: accepted quantities post
  inside the receipt transaction, so a GRN and its stock movement cannot
  come apart. Damaged, missing and extra deliberately do not become stock.
- Warehouse locations, an evidence-document bucket, 11 permissions with
  role defaults (**Viewer gains read access — the first module where that
  role is granted anything**), module documentation set.

## Excluded Scope (respected)

POS sale postings (Phase 07) and order reservations (Phase 09) — their
ledger types are designed and constrained now, consumed later. No
costing, valuation or stock-value reporting (Phase 12/13).

## Dependencies

Phases 01–04 complete. **Inventory needs at least one active warehouse
per company**; staging had none, so warehouses must be created in
Administration → Organization before stock can be recorded. Purchase
orders now carry a destination warehouse — optional while the order is a
draft, required before it can be issued, so a company with no warehouse
yet can still raise orders (see Review Finding 5).

## Database Changes

Migrations `20260806150001` (warehouses become a company-integrity
parent), `150002` (10 tables), `150003` (immutability, derived balances,
RLS), `150004` (nullable-variant balance key), `150005` (bucket, 11
permissions, role mappings, adjustment approval rule), `150006` (batch
posting + the receiving hook + `purchase_orders.warehouse_id`), `150007`
(TRF/ADJ/CNT numbering), `150008` (balance write guard + override-flag
cleanup), `150009` (pinned search_path on both guards), `150010` (an
issued order must name a destination warehouse). Applied to staging
2026-08-06. Production untouched.

## Permission Requirements

11 `inventory.*` keys enforced server-side, with RLS parity per table.
Matrix in `modules/inventory/INVENTORY_PERMISSION_MATRIX.md`. Combination
rules: overriding negative stock requires `negative.override` on top of
the movement's own permission; approving an adjustment posts it, so those
are one permission and one step.

## Audit Requirements

18 event types in `modules/inventory/INVENTORY_AUDIT_EVENTS.md`. Payloads
record what moved and why, never a balance snapshot — the ledger already
answers "what was the balance at time T" exactly, and a copied balance
would be stale the moment the next entry posts.

## File-Storage Requirements

`stock-documents`: private, Internal, 15 MB, image/pdf/csv, 300-second
signed URLs, per-download audit.

## Validation Rules

Zod at every boundary; quantities whole and bounded; magnitude-plus-type
rather than signed input for manual movements, so damage cannot be
recorded as an increase; signed deltas for adjustments, never zero;
transaction type checked against the implemented set; every
client-supplied id re-validated against the acting company.

## Approval Rules

Adjustments only. Seeded tier per company: any adjustment requires
`inventory.adjustment.approve`. Self-approval refused and audited.
Approval posts the ledger entries in the same call.

## Error Handling

Typed ServiceErrors. The database's negative-stock message (naming the
product and the balance it would reach) is surfaced verbatim because it
contains no confidential data; wrong status → conflict; cross-company
reference → invalid_input; a failed posting reverts the status change
that preceded it, so a transfer never claims to have been dispatched
when the stock did not move.

## Security Requirements

Stock data is Internal. Client writes revoked on all 10 tables; the
ledger and balances additionally protected by triggers; both SECURITY
DEFINER functions execute only as `service_role`; every function has a
pinned `search_path`.

## Testing Requirements

20 new unit tests, plus 10 covering the purchase-order destination
(117 total, all passing); staging probes recorded
below; live manual script in `modules/inventory/INVENTORY_TEST_PLAN.md`.

## Migration Plan

Applied dev→staging (files committed). Production only via the
owner-gated deployment plan.

## Rollback Plan

Drop the 10 tables in the dependency order listed in `150002`; drop the
three guard functions and `post_stock_entries`; restore
`record_purchase_receipt` from `20260806140005`, drop constraint
`purchase_orders_issued_needs_destination` and drop
`purchase_orders.warehouse_id`; delete the seeded permission/mapping/rule
rows by key; delete the bucket if empty. App rollback via the previous
Vercel build.

## Deliverables

Implemented scope, module documentation set, cross-cutting doc updates
(permission matrix, audit catalog, storage policy, module roadmap, risk
register, the four audit logs, decision log D-024), verification
evidence, this report.

## Completion Criteria

| Criterion | Verdict | Evidence |
|---|---|---|
| Approved scope implemented | Pass | This document + code tree |
| Excluded scope untouched | Pass | No sale/reservation posting path; types exist but are refused by validation |
| Migrations pass against staging | Pass | 10/10 applied 2026-08-06 |
| Ledger is append-only | Pass | Probe: UPDATE and DELETE both raise; row unchanged; clients hold no grant |
| Balances derive from the ledger only | Pass | Probe: direct INSERT and UPDATE refused even as database owner; posting through the ledger still works |
| Balance ≡ sum(ledger) | Pass | Probe after mixed postings: equal |
| Negative stock blocked | Pass | Probe: −500 against a balance of 100 raised, and left neither ledger row nor balance change |
| Override works and is audited | Pass | Probe: same posting succeeded when flagged; `negative_override_used` written with result=failure |
| Sign matches type | Pass | Probe: `purchase_receipt` with −5 rejected by check constraint; unit tests cover all twelve types |
| Receiving posts stock atomically | Pass | Probe: 6 accepted + 2 damaged → stock 6; a receipt with a foreign line left 1 receipt and stock unchanged, ledger included |
| Permissions enforced server-side | Pass | Every service path behind requirePermission; company re-validation on all client ids |
| Separation of duties on adjustments | Pass | Self-approval refused server-side and audited |
| Phase 04 still works after the Phase 05 wiring | Pass | Orders can be drafted with no warehouse; destination settable while draft; probe confirms the database refuses to move a destination-less order past draft |
| Embed hints verified against the database | Pass | All 16 FK hints checked against `pg_constraint` — the failure mode that broke Phases 03 and 04 |
| Unit tests pass | Pass | 117/117 (20 inventory + 10 purchase-order destination) |
| Lint / typecheck / build pass | Pass | 0 errors, 0 warnings; 8 new routes present |
| Advisors reviewed | Pass | 2 new WARNs (mutable search_path) found and fixed; remaining are the intentional deny-all INFOs and the owner-action password toggle |
| Review executed | Pass | Self-review — 5 findings fixed; **not** independent reviewers (see Review Findings) |
| Documentation updated | Pass | Module set + cross-cutting docs + the four audit logs + D-024 |
| Production untouched | Pass | No operations against pbyjyamqmbotixahkknu |
| Live manual verification (owner) | **Pending** | Script in INVENTORY_TEST_PLAN.md; requires a warehouse to exist first |

## Open Questions

- **Warehouses must be created before any of this can be used.** Staging
  has none. This is Phase 01 functionality (Administration →
  Organization) and deliberately not seeded by implementation.
- Should Viewer really see stock? D-024 says yes (quantities are
  Internal); the owner may narrow it.
- Should a dispatched transfer be cancellable? Currently no — it must be
  received, even at zero, so the stock that left is accounted for.

## Risks

Registered as R-017 and R-018 in `RISK_REGISTER.md`: stock is not yet
valued (no costing until Phase 12, so "how much is this stock worth" has
no answer), and counts do not freeze movement, so a busy warehouse can
produce a variance that reflects concurrent activity rather than error.

## Implementation Checklist

- [x] Activation approved by owner ("move to phase 5", 2026-08-06)
- [x] Full specification (module docs) authored before implementation
- [x] Migrations + reference data applied to staging
- [x] Services, actions, UI implemented
- [x] Phase 04 receiving wired into the ledger
- [x] Unit tests + staging probes
- [x] Cross-cutting docs including the four audit logs
- [ ] Live manual verification (owner)
- [ ] Completion declaration

## Verification Evidence

2026-08-06, staging project `yhrdyyvayistqqwxawqr`:

```
lint:        0 errors, 0 warnings
typecheck:   clean (strict)
unit tests:  117 passed / 117 (9 files; 20 new inventory tests,
             10 purchase-order destination tests)
build:       production build OK — /inventory, /inventory/ledger,
             /inventory/transfers(+[id]), /inventory/adjustments(+[id]),
             /inventory/counts(+[id]) present
migrations:  20260806150001-150009 applied
advisors:    2 new WARNs (mutable search_path on both guard functions)
             found and fixed; re-run clean apart from the 5 intentional
             deny-all INFOs and the owner-action leaked-password WARN

Staging probes (fixtures created, probed, removed; residue 0):
  immutability:   UPDATE stock_ledger -> raised; DELETE -> raised
  balance apply:  +100 opening stock -> balance 100
  negative block: -500 damage -> raised; balance still 100 afterwards
  override:       same posting with the flag -> balance -50, allowed once
  reconciliation: balance == sum(ledger) after the mixed sequence
  sign guard:     purchase_receipt with -5 -> check constraint violation
  derived-only:   direct UPDATE and INSERT on stock_balances -> refused,
                  while posting through the ledger still succeeds
  override reset: a batch that failed mid-way left the override cleared
  receipt hook:   6 accepted + 2 damaged -> stock 6 (damaged excluded);
                  a receipt with a foreign 2nd line rolled back entirely,
                  leaving stock and receipt count unchanged
  fk hints:       all 16 embed hints verified to exist in pg_constraint
production:       untouched
```

## Review Findings (self-review, 2026-08-06)

**Process note:** as in Phase 04, this phase was reviewed by the author
plus the Supabase advisors, not by independent adversarial reviewers.
That remains weaker evidence than Phases 02–03, and the recommendation
to run an independent pass before production now covers Phases 04 and 05
(risk R-015).

1. **A design flaw caught before any code shipped.** The first probe
   failed to insert a balance at all: `stock_balances` used a primary key
   containing `variant_id`, which a primary key forces NOT NULL — so
   every product without variants would have been impossible to stock.
   Fixed with a surrogate key plus a unique index using
   `NULLS NOT DISTINCT`. Worth noting because probing the schema *before*
   building on it is what made this cheap.
2. **The documented rule that balances are derived was unenforced.**
   `app.stock_balances_are_derived()` was written and never attached to a
   trigger, so the service role could have written balances directly and
   desynchronised them from the ledger with nothing to stop it. Now a
   guard trigger refuses every write except the ledger trigger's own,
   which signals itself with a transaction-local flag. Probe confirms a
   direct UPDATE is refused even as the database owner.
3. **The negative-stock override could outlive its failure.** If a ledger
   insert raised mid-batch, `post_stock_entries` returned without
   clearing the override flag. Each RPC is its own transaction so nothing
   could actually exploit it, but a permission flag should not survive the
   error that interrupted it; it is now cleared in an exception handler.
4. **Advisors: mutable `search_path`** on both guard functions — fixed.
5. **This phase broke Phase 04.** Wiring receiving into the ledger meant a
   purchase order needed a destination warehouse, and that requirement was
   put at order *creation*. Staging has no warehouses, so every company's
   New-purchase-order form refused to create anything: a completed,
   owner-signed-off phase stopped working. Nothing in the Phase 05 test
   plan would have caught it, because the plan only exercised Phase 05.

   The first fix was a patch — make the field optional, add a form to set
   it later — and it worked, but it left the new rule living only in
   TypeScript. That is the same shape as finding 2 above: a rule the
   documentation asserts and the database does not enforce. It was
   reverted and redone:

   - **`purchase_orders_issued_needs_destination`**, a check constraint:
     `warehouse_id is not null or status in ('draft','cancelled')`.
     Declared NOT VALID because one Phase 04 order (status `received`)
     predates the column, and back-filling it would invent a fact about a
     delivery nobody recorded. Probe confirms the database refuses to move
     a destination-less order past draft.
   - **`issueBlockReason()`**, a pure function listing every reason an
     order cannot be issued, so the order page says what is missing
     *before* the click instead of only after — the same shape as
     `decisionBlockReason()` for requests.
   - **`resolveDestination()`**, one shared helper, because creation and
     later assignment previously carried separate copies of the same
     checks.
   - **The destination is re-read at issue.** The patch trusted the
     warehouse chosen at drafting time; a warehouse archived in between
     would have been issued into. `destination_inactive` now blocks it.

   Found while redoing it, and fixed in the same pass: the orders page
   called `listWarehouses` inside an unguarded `Promise.all`, so anyone
   who could raise a purchase order but lacked `inventory.view` would
   have got a 500 on `/purchasing/orders` rather than a page. **Not
   reachable under the current role defaults** — every role holding
   `purchasing.order.manage` also holds `inventory.view`, confirmed by
   query — so this is a latent fault, not a live one. It becomes live the
   moment anyone builds a custom role. Both pages now catch the forbidden
   read, and the detail page distinguishes "you cannot see the
   warehouses" from "there are none", because those need different people
   to fix them.

   Lesson: adding a dependency to an earlier phase has to be tested
   against that phase's existing flows, not only against the new one —
   and a fix that only lives in the service layer is half a fix in a
   codebase whose whole premise is that the database enforces its own
   rules.

Accepted risks (recorded, not fixed):

- **Existence oracle via fetch-before-authorize**, systemic across
  Phases 01–05.
- **No independent adversarial review** for Phases 04–05.
- **Counts do not freeze stock.** Movements during a count land in the
  ledger and the variance is measured against the opening snapshot. This
  is deliberate — freezing a warehouse is worse — but a count run during
  heavy activity will show variances that are really timing.

## Final Phase Verdict

**Implemented — pending live verification.** Every code-, schema-,
security- and test-level criterion passes with evidence: 117 unit tests,
10 migrations, and staging probes covering immutability, derivation,
negative stock, the override, sign constraints, atomic receipt posting
and reconciliation.

The phase's central claim — that a balance cannot be anything other than
the sum of its history — is enforced in three independent places: the
ledger cannot be edited, the balance table cannot be written, and the
negative floor sits in the trigger rather than in any service. Each is
demonstrated by a probe that fails loudly if the rule stops holding.

Remaining: warehouses must exist before the owner-side script can run,
then live manual verification and the completion declaration.
