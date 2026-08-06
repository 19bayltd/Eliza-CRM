# Purchasing — Workflow

## 1. Request → approval → order → receipt

```
Employee            Manager / Admin           Admin              Store
   |                       |                    |                  |
 draft  --submit-->  submitted --approve--> approved --issue--> issued
   |                       |  \                                    |
 cancel                  reject                              receive (1..n)
                                                                   |
                                              partially_received / received
```

**Raise (Employee).** Create a request, add lines (product/variant,
quantity, estimated unit price in base currency), submit. The total is
computed with exact decimal math and frozen onto the request at
submission — the approval decision must be made against the amount the
approver actually saw.

A draft is editable by anyone holding `purchasing.request.manage` in the
same company, not only the person who raised it (D-022) — colleagues
routinely finish each other's drafts. Editing stops dead at submission,
and the total is recomputed and shown then, so the requester sees any
change a colleague made before it is frozen.

**Approve (Manager or Administrator).** The engine reads
`approval_rules` for the company, picks the highest matching threshold,
and demands that permission. Below the high threshold a Manager
suffices; at or above it, only Administrator/Owner. Approving your own
request is always refused. Rejection requires a reason. Either way an
`approval_records` row is written.

**Order (Administrator).** An approved request becomes a purchase order
against one supplier. Prices may be pulled from an existing supplier
quotation — the Phase 03 cost wall still applies, so issuing requires
`cost.view`. Issuing freezes the exchange rate. The request moves to
`ordered`.

**Destination (from Phase 05).** Receiving posts accepted quantities
into a warehouse, so an order has to say where the goods land — but only
once it becomes a commitment:

| Stage | Destination |
|---|---|
| Draft | Optional. A company that has not created a warehouse yet must still be able to raise an order. |
| Draft, later | Settable and changeable on the order page by anyone with `order.manage`; the change is audited as `purchase_order.destination_set`. |
| Issue | **Required**, and re-read at that moment — a warehouse archived since drafting blocks the issue rather than receiving stock into a closed site. |

The order page lists what is missing before the Issue button appears
rather than failing after the click, and the database carries the same
rule as `purchase_orders_issued_needs_destination`, so no path — service,
script or console — can put a live order into the world with nowhere to
deliver it.

**Receive (Manager).** Each delivery records accepted, damaged, missing
and extra quantities per line, in a single transaction with the
purchase-order status update. Multiple partial receipts are normal; the
order reaches `received` only when every line's accepted quantity meets
the ordered quantity.

## 2. Samples

```
requested --dispatch--> dispatched --receive--> received --evaluate--> evaluated
     \                                                                  (approved
      --cancel                                                         | rejected)
```

Samples run independently of requests and orders — they usually
*precede* a bulk commitment. Evaluation records the outcome, a reason,
and who decided. Photos attach to the sample record.

## 3. Rules that hold everywhere

- Nothing is deleted. Cancellation, rejection and archival are status
  transitions with reasons, all audited.
- Approved and issued records are never silently edited — corrections
  are new records (cancel and re-issue), so history stays truthful.
- Numbers (`PR-`, `PO-`, `GRN-`, `SR-`) are allocated per company per
  year under a row lock, so two simultaneous submissions cannot collide.
- Every status transition re-checks the current state at write time, so
  two people acting at once cannot drive a record into an impossible
  state.
