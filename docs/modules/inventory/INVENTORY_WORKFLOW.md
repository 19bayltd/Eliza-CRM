# Inventory — Workflow

## 1. How stock comes to exist

```
Phase 04 receipt ──accepted qty──┐
Opening stock ───────────────────┼──> stock_ledger (append-only)
Transfer in ─────────────────────┤          │
Adjustment (approved) ───────────┤          │ trigger
Count correction ────────────────┘          v
                                      stock_balances (derived)
```

Nothing writes to `stock_balances` directly. The only way to change a
balance is to write a ledger entry, and the only way to remove a ledger
entry is to post its opposite — which itself becomes history.

**Receiving is the important one.** When Phase 04 records a receipt, the
accepted quantities post to the ledger *inside the same database
transaction*. If the ledger posting fails — negative stock, a missing
warehouse — the entire receipt rolls back. There is no state where the
paperwork says goods arrived but stock disagrees.

## 2. Transfers

```
draft --dispatch--> dispatched --receive--> received
  |                     |
cancel            (goods in transit:
                   out of source, not yet in destination)
```

Dispatch posts `transfer_out` at the source. Receipt posts `transfer_in`
at the destination. The gap between them is deliberate and visible: goods
on a truck belong to neither warehouse's available stock, and pretending
otherwise is how stock reports start lying.

A transfer cannot be received into the warehouse it left, and quantities
received cannot exceed those dispatched.

## 3. Adjustments — the only way stock changes by decree

```
draft --submit--> submitted --approve--> approved+posted
                       \
                        --reject--> rejected (reason required)
```

Everything else in this module records something that physically
happened. An adjustment asserts a change without a physical event, which
is why it is the one flow that requires approval, reuses the Phase 04
approval engine, refuses self-approval, and posts to the ledger only at
the moment of approval — approve and post are a single guarded step, so
an approved adjustment cannot linger unposted or be posted twice.

## 4. Counts

```
draft --start--> counting --post--> posted
```

Opening a count snapshots the system quantity per line. Staff enter what
they physically counted. Posting writes one `count_correction` entry per
line where counted ≠ system, and nothing at all for lines that matched.

The snapshot matters: if stock moves during the count, the variance is
measured against what the system believed when counting began, and the
intervening movements remain in the ledger. Nobody has to choose between
freezing the warehouse and having a trustworthy count.

## 5. Rules that hold everywhere

- Ledger rows are never updated or deleted — a database trigger raises on
  the attempt, and clients hold no UPDATE/DELETE grant regardless.
- A balance may never go below zero. The check lives in the trigger, so
  it applies to every future phase's postings too, and is bypassable only
  with an explicitly-held override permission that audits its own use.
- Every posting names its source: the reference type, id and human number
  (`GRN-2026-0002`, `ADJ-2026-0001`) travel with the ledger entry, so any
  quantity on screen can be traced back to the event that caused it.
