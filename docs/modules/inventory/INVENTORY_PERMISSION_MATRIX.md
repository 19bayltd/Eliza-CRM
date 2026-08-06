# Inventory — Permission Matrix

Server-side enforcement first (`requirePermission`), RLS parity second,
and the negative-stock block sits deeper still — in the database trigger,
where no permission can bypass it without the explicit override.

## Permissions

| Key | Grants |
|---|---|
| `inventory.view` | See balances, ledger history, transfers, adjustments, counts |
| `inventory.movement.post` | Post opening stock, damage, supplier returns |
| `inventory.transfer.manage` | Create, dispatch, cancel transfers |
| `inventory.transfer.receive` | Receive an in-transit transfer |
| `inventory.adjustment.manage` | Raise and submit adjustments |
| `inventory.adjustment.approve` | Approve or reject adjustments |
| `inventory.count.manage` | Open, enter and post stock counts |
| `inventory.negative.override` | Post a movement that drives a balance below zero |
| `inventory.location.manage` | Create and archive warehouse locations |
| `inventory.document.download` | Download count sheets and evidence |
| `inventory.document.manage` | Upload and remove them |

## Default role mappings

| Permission | Owner | Administrator | Manager | Employee | Viewer |
|---|---|---|---|---|---|
| view | ✅ | ✅ | ✅ | ✅ | ✅ |
| movement.post | ✅ | ✅ | ✅ | — | — |
| transfer.manage | ✅ | ✅ | ✅ | — | — |
| transfer.receive | ✅ | ✅ | ✅ | — | — |
| adjustment.manage | ✅ | ✅ | ✅ | — | — |
| **adjustment.approve** | ✅ | ✅ | — | — | — |
| count.manage | ✅ | ✅ | ✅ | — | — |
| **negative.override** | ✅ | ✅ | — | — | — |
| location.manage | ✅ | ✅ | ✅ | — | — |
| document.download | ✅ | ✅ | ✅ | ✅ | — |
| document.manage | ✅ | ✅ | ✅ | — | — |

## Consequences of these defaults

- **Everyone can see stock, including Viewer.** Quantities are Internal,
  not Confidential — unlike purchase prices. A viewer who can see what
  is in the warehouse can do their job; this is the first module where
  Viewer is granted anything.
- **A manager moves stock but cannot invent it.** They post movements,
  run transfers and counts, and raise adjustments — but approving an
  adjustment, which is the one operation that changes stock by decree,
  requires Administrator or Owner.
- **Nobody approves their own adjustment**, enforced server-side exactly
  as in purchasing.
- **Negative stock needs a deliberate, separately-held permission.** A
  manager who finds unrecorded stock cannot override; they raise an
  adjustment instead, which leaves an approval trail.

## Combination rules

- Posting an adjustment requires `adjustment.approve` **and** an approved
  adjustment record — approval and posting are one guarded step, so an
  approved adjustment cannot sit unposted or be posted twice.
- Receiving a transfer requires `transfer.receive` **and** `view` on the
  destination warehouse's company.
- Overriding negative stock requires `negative.override` **on top of**
  whichever permission the movement itself needs.
