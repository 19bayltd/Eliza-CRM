# Suppliers Module — Workflows

## Record a supplier

1. Suppliers → company card → New supplier: code (`SUP-CN-001` style),
   name, country, capabilities, address, notes.
2. Open the supplier → Add contact (name, role, phone, WeChat/WhatsApp,
   email) — as many as needed.
3. Archive-only lifecycle: archiving needs a reason and is refused while
   the supplier still has active quotations.

## Record a quotation (cost-permission holders)

1. Supplier page → New quotation: pick the product (optionally a
   variant), quoted unit price + currency, the exchange rate to the
   company's base currency at quote time, MOQ, lead time, valid-until,
   terms.
2. The rate is CAPTURED with the quote so history stays accurate when
   market rates move.
3. Users with quotation-view but not cost-view see the quotation row
   with `•••` where prices would be.

## Compare quotations

Suppliers → Compare quotations → pick a product: every quotation side by
side with quoted price and the normalized price in the company base
currency. Expired validity dates are visible in the table.

## Private documents

Supplier page → Upload document (contract, price list, certificate; pdf,
image, or office file up to 25 MB). Downloads are per-file audited; the
registry keeps a permanent trail even after removal (soft delete).

## Who sees what

- Employee: supplier directory + contacts only.
- Manager: + manage suppliers/contacts, see quotations WITHOUT prices.
- Administrator/Owner: + prices, quotation management, documents.
- Viewer: no supplier access.
- Other companies' suppliers: never (RLS-enforced).
