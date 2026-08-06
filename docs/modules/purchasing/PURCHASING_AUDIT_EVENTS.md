# Purchasing — Audit Events

Conventions per `AUDIT_EVENT_CATALOG.md`. Module = `purchasing`.
**No price, exchange-rate, or order-total value ever appears in a
payload.** Amount-driven decisions record the rule that applied, not the
money.

| Action | When | Payload (values only, never prices) |
|---|---|---|
| `purchase_request.created` | Request created | number, line count |
| `purchase_request.updated` | Draft edited | number, changed fields |
| `purchase_request.submitted` | Sent for approval | number, line count |
| `purchase_request.approved` | Approved | number, rule applied, approver |
| `purchase_request.rejected` | Rejected (reason required) | number, rule applied |
| `purchase_request.cancelled` | Cancelled (reason required) | number, previous status |
| `purchase_request.self_approval_refused` | Requester tried to approve own request | number |
| `approval.recorded` | Any approval decision | module, entity type, entity number, decision |
| `purchase_order.created` | Draft order created | number, supplier, line count |
| `purchase_order.destination_set` | Delivery warehouse chosen or changed on a draft | number, previous and new warehouse code |
| `purchase_order.issued` | Committed to supplier | number, supplier, currency |
| `purchase_order.cancelled` | Cancelled (reason required) | number, previous status |
| `purchase_order.cost_viewed` | Prices exposed to a user | `{lines_with_prices: n}` — count only |
| `purchase_order.orphan_cleanup_failed` | A line's price insert failed AND removing the orphaned line also failed (`result=failure`) | number, line id |
| `purchase_receipt.recorded` | Receipt posted atomically | GRN number, PO number, line count, resulting PO status |
| `purchase_receipt.discrepancy` | Damaged / missing / extra present | GRN number, per-line quantities |
| `sample.requested` | Sample raised | number, supplier, product |
| `sample.dispatched` | Marked dispatched | number, tracking reference |
| `sample.received` | Marked received | number |
| `sample.evaluated` | Outcome recorded (reason required) | number, outcome |
| `sample.cancelled` | Cancelled (reason required) | number, previous status |
| `purchase.document_uploaded` | Document/photo attached | entity number, title |
| `purchase.document_removed` | Document removed | entity number, title, file id |

Storage events (`file.uploaded`, `file.downloaded`, `file.deleted`) are
emitted by the storage service for both buckets, as in Phases 01–03.

## Why quantities are logged but money is not

Quantities and discrepancies are the operational record — a receiving
dispute needs them. Prices are Confidential: they are readable only
through the audited service path, and the audit log records *that* they
were read and by whom, never *what* they were. This keeps the audit log
from becoming an unprotected second copy of the commercial data, the
same rule Phase 03 established for quotation costs.
