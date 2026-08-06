# Purchasing — Permission Matrix

Server-side enforcement first (`requirePermission`), RLS parity second.
Every client-supplied id is re-validated against the acting company.

## Permissions

| Key | Grants |
|---|---|
| `purchasing.request.view` | See purchase requests and their lines |
| `purchasing.request.manage` | Create, edit, submit, cancel requests |
| `purchasing.request.approve` | Approve/reject requests below the high threshold |
| `purchasing.request.approve.high` | Approve/reject requests at or above it |
| `purchasing.order.view` | See purchase orders, lines, quantities, statuses |
| `purchasing.order.manage` | Create, issue, cancel purchase orders |
| `purchasing.cost.view` | See order prices, rates, and totals (audited) |
| `purchasing.receive` | Record receipts against issued orders |
| `purchasing.sample.view` | See sample requests |
| `purchasing.sample.manage` | Raise, dispatch, receive, evaluate samples |
| `purchasing.document.download` | Download purchase documents / sample photos |
| `purchasing.document.manage` | Upload and remove them |

## Default role mappings

| Permission | Owner | Administrator | Manager | Employee | Viewer |
|---|---|---|---|---|---|
| request.view | ✅ | ✅ | ✅ | ✅ | — |
| request.manage | ✅ | ✅ | ✅ | ✅ | — |
| request.approve | ✅ | ✅ | ✅ | — | — |
| request.approve.high | ✅ | ✅ | — | — | — |
| order.view | ✅ | ✅ | ✅ | — | — |
| order.manage | ✅ | ✅ | — | — | — |
| **cost.view** | ✅ | ✅ | — | — | — |
| receive | ✅ | ✅ | ✅ | — | — |
| sample.view | ✅ | ✅ | ✅ | ✅ | — |
| sample.manage | ✅ | ✅ | ✅ | — | — |
| document.download | ✅ | ✅ | ✅ | — | — |
| document.manage | ✅ | ✅ | ✅ | — | — |

## Consequences of these defaults

- **An employee can ask but not commit.** They raise and submit
  requests, and see samples, but cannot approve, order, or receive.
- **A manager approves ordinary spend, not large spend.** Requests at
  or above the high threshold escalate to Administrator/Owner. The
  threshold is a row in `approval_rules`, changeable without a deploy.
- **A manager never sees purchase prices.** Order rows show quantities
  and status; prices render `•••`, mirroring Phase 03 quotations. The
  server does not fetch cost rows for them at all.
- **Nobody approves their own request.** Enforced server-side
  regardless of permissions held (self-approval refusal is audited).
- **Viewer sees nothing in this module.**

## Combination rules

- Issuing a purchase order requires `order.manage` **and** `cost.view`
  — you cannot commit money you are not allowed to see.
- Receiving requires `receive` **and** `order.view`.
- Approving requires the permission named by the matching approval rule,
  evaluated against the request total at decision time.
