# Suppliers Module — Test Plan

## Unit (automated, `tests/unit/suppliers-validation.test.ts` — 10 tests)

- Supplier code schema: uppercasing, dashes/underscores, rejects
- Unit price: ≤4 decimals, positive, string-typed
- Exchange rate: ≤6 decimals, positive
- Quotation schema: currency normalization, numeric coercion of
  MOQ/lead-time, empty-optional handling, date format, bad currency

## Staging RLS probe (executed 2026-08-06, fixtures rolled back, 0 residue)

- Administrator: sees fixture supplier, quotation, AND cost row (1/1/1)
- Employee (`suppliers.view` only): sees the supplier (1) but ZERO
  quotations, ZERO cost rows (the price wall), ZERO documents
- Employee INSERT into suppliers: denied 42501 (client writes revoked)

## Live manual script (owner-side)

1. Create a supplier per company style (`SUP-BD-001`); bad code refused
2. Add two contacts; archive one with a reason
3. Create a quotation (price, currency, rate, MOQ, lead time, validity)
   against a real product; verify audit has `quotation.created` WITHOUT
   the price
4. Compare page: quotations for the product with quoted + normalized
   prices
5. As a Manager-role user: quotation rows visible, prices shown as `•••`,
   no New-quotation form
6. As Employee: supplier directory visible; no Quotations or Documents
   sections at all
7. Upload a document; download it; verify `file.downloaded` in audit;
   remove it
8. Archive attempt on a supplier with an active quotation → refused;
   archive the quotation first, then the supplier
9. Audit log shows the full trail with reasons
