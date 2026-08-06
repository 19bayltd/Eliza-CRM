# Suppliers Module — Specification

**Purpose:** Supplier directory (China/Bangladesh and beyond), contacts,
confidential quotations with currency-normalized comparison, and private
supplier documents.

## Entities and tables

| Table | Entity | Notes |
|---|---|---|
| `suppliers` | Supplier | per-company code `^[A-Z0-9][A-Z0-9_-]*$`, name, ISO-2 country, capabilities, archive-only; archive refused while active quotations exist |
| `supplier_contacts` | Contact person | name/role/phone/messaging/email, archive-only |
| `supplier_quotations` | Quotation metadata | supplier + product (+optional variant), MOQ, lead time, valid-until, terms; visible with `suppliers.quotation.view` |
| `supplier_quotation_costs` | **Confidential** price data | 1:1 with quotation; `numeric(14,4)` unit price, ISO currency, `numeric(16,6)` exchange rate (base-currency units per quote-currency unit, captured at quote time); RLS requires `suppliers.quotation.cost.view` |
| `supplier_documents` | Private document registry | rows over `file_metadata`; objects in `supplier-documents` bucket (confidential, 25 MB, pdf/image/office); RLS requires `suppliers.document.download` |

## Confidentiality model

Prices are split from quotation metadata exactly as product intelligence
is split from products: the costs table is RLS-walled behind
`suppliers.quotation.cost.view`, price reads through the app are audited
(`quotation.cost_viewed`), and price values never enter audit payloads.
Creating a quotation includes a price, so it requires
`suppliers.quotation.manage` AND the cost permission together.

## Comparison

`/suppliers/compare?product=…` lists every quotation for a product with
the quoted price and a normalized figure (unit price x captured exchange
rate → company base currency), so CN/USD and BD/BDT quotes compare
directly. Restricted to cost-permission holders.

## Permissions

See `SUPPLIERS_PERMISSION_MATRIX.md` (7 keys under `suppliers.*`).

## Validation

Zod at every boundary: codes, ISO country/currency, prices and rates as
decimal strings (4/6 dp, never floats), whole-number MOQ/lead-time,
ISO-date validity; every client-supplied ID re-validated against the
target company server-side.

## Audit events

See `SUPPLIERS_AUDIT_EVENTS.md` (11 event types); storage events cover
each document object, including every download.

## Tests

See `SUPPLIERS_TEST_PLAN.md`: 10 unit tests (57 total), staging RLS
probe (price wall + write revocation), live manual script.
