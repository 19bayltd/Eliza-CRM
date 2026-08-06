# Inventory — Audit Events

Conventions per `AUDIT_EVENT_CATALOG.md`. Module = `inventory`.

Payloads record **what moved and why**, never a balance snapshot — a
balance in an audit row would be stale the moment the next entry posts,
and the ledger already answers "what was the balance at time T" exactly.

| Action | When | Payload |
|---|---|---|
| `stock.movement_posted` | A manual movement is posted (opening stock, damage, supplier return) | type, warehouse, sku, quantity, reason |
| `stock.negative_override_used` | A posting drove a balance below zero under override (`result=failure`) | type, warehouse, sku, quantity, resulting balance |
| `stock.transfer_created` | Transfer drafted | number, from/to warehouse, line count |
| `stock.transfer_dispatched` | `transfer_out` posted | number, from warehouse, line count |
| `stock.transfer_received` | `transfer_in` posted | number, to warehouse, line count |
| `stock.transfer_cancelled` | Cancelled (reason required) | number, previous status |
| `stock.adjustment_created` | Adjustment drafted | number, line count |
| `stock.adjustment_submitted` | Sent for approval | number, line count |
| `stock.adjustment_approved` | Approved **and posted** in one step | number, rule applied, entries posted |
| `stock.adjustment_rejected` | Rejected (reason required) | number, rule applied |
| `stock.adjustment_self_approval_refused` | Requester tried to approve their own (`result=failure`) | number |
| `stock.count_opened` | Count opened, system quantities snapshotted | number, warehouse, line count |
| `stock.count_posted` | Variances posted as corrections | number, lines with variance, entries posted |
| `stock.count_cancelled` | Cancelled (reason required) | number, previous status |
| `stock.location_created` / `_archived` | Warehouse location lifecycle | warehouse, code |
| `stock.document_uploaded` / `_removed` | Count sheet or evidence file | number, title |
| `approval.recorded` | Any adjustment decision (shared with purchasing) | module, entity type, entity number, decision |

Storage events (`file.uploaded`, `file.downloaded`, `file.deleted`) come
from the storage service for the `stock-documents` bucket.

## Why the ledger is not duplicated into the audit log

Every ledger row is already immutable, attributed (`created_by`), timed,
and reason-carrying. Copying each movement into the audit log would
create a second permanent record that could drift from the first. The
audit log therefore records the **actions people took** — posted,
transferred, approved, overrode — while the ledger records the
**movements themselves**, and the two are joined by reference id.
