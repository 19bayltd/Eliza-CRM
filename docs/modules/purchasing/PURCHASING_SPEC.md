# Purchasing Module — Specification

**Purpose:** Turn an internal need into a controlled commitment to a
supplier, and record what actually arrived.

**Business owner:** Owner / Administrator (approval authority),
Manager (day-to-day requesting, receiving, samples).

**Users:** Employees raise requests; Managers approve within their
threshold and receive goods; Administrators issue purchase orders and
see supplier costs.

**Activating phase:** Phase 04 (owner instruction 2026-08-06).

## 1. Entities

| Entity | Table | Purpose |
|---|---|---|
| Purchase request | `purchase_requests` | An internal ask, numbered `PR-YYYY-####` per company |
| Request line | `purchase_request_lines` | Product/variant, quantity, estimated unit price |
| Approval rule | `approval_rules` | Configurable threshold → required permission |
| Approval record | `approval_records` | Requester/approver decision pair for any gated action |
| Purchase order | `purchase_orders` | Commitment to a supplier, numbered `PO-YYYY-####` |
| Order line | `purchase_order_lines` | Product/variant and ordered quantity |
| Order line cost | `purchase_order_line_costs` | **Confidential** unit price, currency, exchange rate |
| Receipt | `purchase_receipts` | A receiving event, numbered `GRN-YYYY-####` |
| Receipt line | `purchase_receipt_lines` | Accepted / damaged / missing / extra quantities |
| Sample request | `sample_requests` | Sample ask, dispatch, receipt, evaluation |

Every table carries `company_id` and is tied to its parent by a
composite `(id, company_id)` foreign key, so a child can never belong
to a different company than its parent.

## 2. Money and quantities

- Quantities are whole numbers (`integer`, > 0, ≤ 1,000,000 per line).
- Estimated prices on requests are `numeric(14,4)` in the **company base
  currency** — Internal classification, used for approval thresholds.
- Purchase-order prices are `numeric(14,4)` with ISO currency and a
  `numeric(16,6)` exchange rate captured at issue time, stored in the
  **separate walled table** `purchase_order_line_costs`.
- All arithmetic (line totals, order totals, threshold comparison) uses
  exact decimal math — never floating point.

## 3. Status workflows

**Purchase request:** `draft → submitted → approved | rejected`;
`approved → ordered` when a purchase order references it; `draft` and
`submitted` may be `cancelled`. Terminal states are never edited.

**Purchase order:** `draft → issued → partially_received → received`;
`draft` and `issued` may be `cancelled`. An issued order is never
silently edited — corrections are made by cancelling and re-issuing.

**Sample request:** `requested → dispatched → received → evaluated`;
evaluation records an `approved` or `rejected` outcome; any pre-evaluation
state may be `cancelled`.

Every transition requires the matching permission, is audited, and
carries a mandatory reason where it is a refusal, cancellation, or
rejection.

## 4. The approval engine

Approval requirements are **rows, not code** (`approval_rules`):

| Column | Meaning |
|---|---|
| `company_id` | Rules are per company |
| `action` | e.g. `purchase_request.approve` |
| `min_amount` | Applies when the record's total ≥ this amount (base currency) |
| `required_permission` | Permission key the approver must hold |

Evaluation picks the **highest** `min_amount` rule that the amount
satisfies, so thresholds escalate: a small request needs
`purchasing.request.approve`; one at or above the high threshold needs
`purchasing.request.approve.high`. Rules are seeded per company at
activation (D-021) and are editable data — changing an approval
threshold never requires a deployment.

Each decision writes an `approval_records` row in the master shape:
requester, approver, previous value, proposed value, reason, status,
dates, note. Approved records are never silently modified.

## 5. Receiving (atomic)

Receiving is the phase's transactional core, per
`DATABASE_ARCHITECTURE.md` §6. A single SECURITY DEFINER function
`app.record_purchase_receipt(...)` performs, in one transaction:

1. insert the `purchase_receipts` header (with its GRN number),
2. insert every `purchase_receipt_lines` row (accepted / damaged /
   missing / extra),
3. recompute and update the purchase-order status
   (`partially_received` or `received`).

Any failure rolls the whole thing back — there is no partial receipt.
Over-receipt beyond the ordered quantity is recorded as `extra`, never
silently folded into `accepted`.

**Phase 05 dependency:** the inventory ledger does not exist yet, so
receiving records quantities without stock postings. The function is
the single place Phase 05 will add ledger entries, keeping that change
atomic too.

## 6. Permissions (12)

`purchasing.request.view`, `purchasing.request.manage`,
`purchasing.request.approve`, `purchasing.request.approve.high`,
`purchasing.order.view`, `purchasing.order.manage`,
`purchasing.cost.view`, `purchasing.receive`,
`purchasing.sample.view`, `purchasing.sample.manage`,
`purchasing.document.download`, `purchasing.document.manage`.

Role defaults and the full matrix live in
`PURCHASING_PERMISSION_MATRIX.md`. Order existence and order **prices**
are separate permissions, exactly as quotations and their costs are in
Phase 03.

## 7. Data classification

| Data | Class |
|---|---|
| Requests, quantities, statuses, sample records | Internal |
| Estimated prices on requests | Internal |
| **Purchase-order prices, exchange rates, order totals** | **Confidential** |
| Purchase documents | Confidential |
| Sample photos | Internal |

## 8. Audit, validation, files, errors

- Audit events: `PURCHASING_AUDIT_EVENTS.md`. Price values never appear
  in audit payloads; `purchase_order.cost_viewed` records exposure
  counts only.
- Validation: Zod at every boundary, server authoritative; decimal
  strings for money; real calendar dates; every client-supplied id
  re-validated against the acting company.
- Files: bucket `purchase-documents` (confidential, 25 MB, pdf/image/
  office) and `sample-photos` (internal, 10 MB, images) per
  `FILE_STORAGE_POLICY.md`.
- Errors: typed `ServiceError`s; duplicate numbers → conflict; wrong
  status → conflict; cross-company references → invalid_input; no
  silent failures.

## 9. Completion criteria

Enumerated with Pass/Fail evidence in
`docs/phases/PHASE_04_PURCHASING_AND_SAMPLES.md` at completion.
