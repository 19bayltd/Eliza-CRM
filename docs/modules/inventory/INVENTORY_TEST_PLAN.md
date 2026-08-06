# Inventory — Test Plan

## Unit (automated)

- Quantity schemas: whole, non-zero for movements, signed where allowed,
  bounded; rejects decimals and overflow
- Transaction-type guard: the twelve types parse, but types not yet
  posted by any implemented path (sale, reservation, …) are rejected
- Signed-quantity rules per type: `transfer_out`/`damage`/`sale` must be
  negative, `transfer_in`/`purchase_receipt`/`opening_stock` positive,
  `adjustment`/`count_correction` either but never zero
- Variance arithmetic for counts (counted − system), including zero
  variance producing no entry
- Transfer guards: cannot transfer to the same warehouse; received
  quantity cannot exceed dispatched
- Status-transition guards for transfers, adjustments and counts
- Approval-rule selection for `stock_adjustment.approve` (shared engine)

## Staging probes (SQL, fixtures removed afterwards)

1. **Immutability** — `UPDATE stock_ledger` and `DELETE FROM stock_ledger`
   both raise; the row is unchanged afterwards
2. **Balance ≡ ledger** — after a mixed sequence of postings, every
   `stock_balances.quantity` equals the sum of its ledger entries
3. **Negative block** — a posting that would go below zero raises, and
   leaves neither a ledger row nor a balance change
4. **Override path** — the same posting succeeds when flagged, and the
   balance goes negative exactly once, with the audit event written
5. **Atomic receipt posting** — a Phase 04 receipt whose ledger posting
   fails leaves no receipt header, no receipt lines, no ledger rows and
   an unchanged purchase-order status
6. **Cross-company isolation** on every new table
7. **Composite company FK** rejects a mis-stamped child row
8. **Client writes denied** (42501) on ledger and balances
9. **Concurrency** — two simultaneous postings against the same balance
   serialize rather than interleave into a wrong total

## Live manual script (owner-side)

1. Post opening stock for a product; confirm the balance appears.
2. Post damage larger than the balance → refused, naming the product.
3. Transfer between two warehouses: dispatch, then confirm the source
   balance dropped and the destination has not risen yet; receive, then
   confirm it has.
4. Raise an adjustment, submit it, try to approve it yourself → refused
   and audited; approve as a second user → stock changes at that moment.
5. Open a count, enter a different quantity, post → variance appears as
   a `count_correction` and the balance matches the counted figure.
6. Receive goods against a Phase 04 purchase order → stock rises by the
   accepted quantity, in the same instant the GRN is written.
7. Attempt to edit or delete a ledger row from the app → impossible; no
   interface offers it, and the database refuses it.
8. Audit review: every action present with reasons; no balance snapshots.

Every observation is confirmed against the database before a check is
marked Pass.
