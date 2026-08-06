# Inventory Module — Specification

**Purpose:** Make stock balances trustworthy. Every unit that moves leaves
a permanent record, and the balance is a consequence of those records —
never a number someone typed.

**Business owner:** Owner / Administrator (adjustments, overrides),
Manager (day-to-day movements, transfers, counts).

**Users:** Warehouse staff post movements and count stock; Managers run
transfers and raise adjustments; Administrators approve adjustments and
negative-stock overrides.

**Activating phase:** Phase 05 (owner instruction 2026-08-06).

## 1. The central rule

`stock_ledger` is **append-only**. A row, once written, can never be
updated or deleted — enforced by a database trigger, not by convention,
and additionally by revoking UPDATE/DELETE from every client role. A
mistake is corrected by posting a compensating entry, so the error and
its correction both remain visible.

`stock_balances` is **derived**. It is maintained solely by the trigger
that fires on ledger inserts; no service, action or user writes to it.
The balance for a (warehouse, product, variant) is therefore always the
sum of its ledger entries — a property a probe can verify, and does.

## 2. Entities

| Entity | Table | Purpose |
|---|---|---|
| Ledger entry | `stock_ledger` | One immutable stock movement, quantity signed (+in / −out) |
| Balance | `stock_balances` | Derived quantity per warehouse/product/variant |
| Location | `warehouse_locations` | Optional bin/zone inside a warehouse |
| Transfer | `stock_transfers` + `_lines` | Movement between warehouses, `TRF-YYYY-####` |
| Adjustment | `stock_adjustments` + `_lines` | Approval-gated correction, `ADJ-YYYY-####` |
| Count | `stock_counts` + `_lines` | Physical count and its variance, `CNT-YYYY-####` |
| Evidence | `stock_documents` | Count sheets and photos |

Every table carries `company_id` and is pinned to its parent by a
composite `(id, company_id)` foreign key.

## 3. Transaction types

All twelve types from `DATABASE_ARCHITECTURE.md` §5 exist from day one,
so later phases add behaviour without changing the schema:

| Type | Sign | Posted by |
|---|---|---|
| `opening_stock` | + | Phase 05 (manual, once per line) |
| `purchase_receipt` | + | **Phase 04 receiving — wired in this phase** |
| `transfer_out` | − | Phase 05 transfer dispatch |
| `transfer_in` | + | Phase 05 transfer receipt |
| `damage` | − | Phase 05 manual posting |
| `adjustment` | ± | Phase 05, approval-gated |
| `count_correction` | ± | Phase 05 count posting |
| `supplier_return` | − | Phase 05 manual posting |
| `sale` | − | Phase 07 (POS) |
| `customer_return` | + | Phase 07/09 |
| `reservation` | − | Phase 09 |
| `reservation_release` | + | Phase 09 |

Types not yet posted by any code path are rejected by the validation
layer, so an unimplemented type cannot be smuggled in early.

## 4. Negative stock

The balance trigger refuses any entry that would drive a balance below
zero, raising a typed error naming the product and warehouse. The block
lives in the database, so it holds regardless of which service, script
or future phase posts the entry.

An override exists for genuine cases (stock physically present but not
yet recorded). It requires `inventory.negative.override`, is passed
explicitly per posting, and writes `stock.negative_override_used` to the
audit log with `result=failure` semantics — the movement succeeds, but
the exception is recorded as an exception.

## 5. Workflows in brief

**Transfer:** `draft → dispatched → received`, cancellable before
dispatch. Dispatch posts `transfer_out` from the source; receipt posts
`transfer_in` at the destination. Between the two, the goods are in
transit — visible, and deliberately absent from both warehouses'
available stock.

**Adjustment:** `draft → submitted → approved → posted`, or rejected.
Approval reuses the Phase 04 engine (`approval_rules`, action
`stock_adjustment.approve`) with the same rules: highest matching
threshold wins, self-approval refused server-side, every decision
written to `approval_records`.

**Count:** `draft → counting → posted`. Each line records the counted
quantity against the system quantity captured when the count opened; the
variance posts as `count_correction`. Counting does not freeze stock —
the count records what was seen at that moment, and the variance is the
truth of the difference.

## 6. Permissions (11)

`inventory.view`, `inventory.movement.post`, `inventory.transfer.manage`,
`inventory.transfer.receive`, `inventory.adjustment.manage`,
`inventory.adjustment.approve`, `inventory.count.manage`,
`inventory.negative.override`, `inventory.location.manage`,
`inventory.document.download`, `inventory.document.manage`.

Matrix and combination rules in `INVENTORY_PERMISSION_MATRIX.md`.

## 7. Data classification

Balances, movements, transfers, counts and locations are **Internal**.
Nothing in this module is Confidential — quantities are not prices — but
everything is company-scoped and permission-gated, and count evidence
files follow the storage policy.

## 8. Audit, validation, files, errors

- Events in `INVENTORY_AUDIT_EVENTS.md`; every ledger-affecting action
  is audited with the entry count and resulting status, never with a
  balance snapshot that could go stale.
- Validation: Zod at every boundary; quantities are whole numbers,
  non-zero for movements, bounded; every client-supplied id re-validated
  against the acting company; transaction type checked against the
  implemented set.
- Files: bucket `stock-documents` (private, Internal, 15 MB,
  image/pdf/csv), 300-second signed URLs, per-download audit.
- Errors: typed `ServiceError`s. Negative stock → conflict naming the
  product; wrong status → conflict; cross-company reference →
  invalid_input; ledger update/delete attempt → database exception.

## 9. Completion criteria

Enumerated with Pass/Fail evidence in
`docs/phases/PHASE_05_INVENTORY_AND_WAREHOUSE.md` at completion.
