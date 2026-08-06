# Purchasing — Test Plan

## Unit (automated)

- Number formatting and per-company/per-year sequence keys
- Quantity schema: whole numbers, > 0, ≤ 1,000,000; rejects decimals,
  negatives, overflow
- Estimated-price and unit-price schemas: decimal strings, ≤ 4 dp
- Exact decimal line and order totals (`sumLineTotals`), including
  cases where float arithmetic misrounds
- Approval-rule selection: picks the highest matching threshold;
  falls back to the base rule; boundary amount exactly at the threshold
  escalates (≥, not >)
- Status-transition guards for request, order, and sample machines
- Receipt arithmetic: accepted/damaged/missing/extra sum handling,
  over-receipt classified as `extra`, resulting PO status

## Staging probes (SQL, fixtures rolled back)

- Cross-company isolation on every new table
- Price wall: a role with `order.view` but not `cost.view` sees 0 rows
  in `purchase_order_line_costs`
- Client writes denied (42501) on all purchasing tables
- Composite company-integrity FK rejects a mis-stamped child row
- `app.record_purchase_receipt` rolls back entirely on a forced failure
  (no orphan header, no partial lines, PO status unchanged)
- Concurrent number allocation produces no duplicates

## Live manual script (owner-side)

1. As Employee: raise a request with two lines, submit it. Confirm the
   total shown matches the frozen total on the submitted record.
2. As the same Employee: attempt to approve it → refused
   (self-approval), audited.
3. As Manager: approve a below-threshold request; reject another with a
   reason. Confirm both write approval records.
4. Raise a request above the high threshold and try to approve as
   Manager → refused, escalation message names no amounts it shouldn't.
5. As Administrator: approve it, then issue a purchase order against a
   supplier; confirm the request becomes `ordered`.
6. As Manager: open the order → quantities visible, prices `•••`, and
   **no `purchase_order.cost_viewed` event recorded for that user**.
7. As Manager: receive part of the order (some accepted, some damaged,
   some missing) → order becomes `partially_received`; receive the rest
   → `received`. Confirm one receipt per event, nothing partial.
8. Attempt to receive against a cancelled or draft order → refused.
9. Sample lifecycle: request → dispatch → receive → evaluate with an
   outcome and reason; attach a photo; download it; remove it.
10. Audit review: full trail with reasons, discrepancies recorded, and
    **zero price values anywhere in the log**.

Every observation is confirmed against the database (rows, audit
entries, storage objects) before a check is marked Pass — screenshots
alone are not accepted as evidence.
