# Products Module — Workflows

## Set up the catalog (once per company)

1. Products → Catalog: add units (PCS…), categories (nested via
   Parent), attributes (SIZE, COLOR…) and their values.
2. Archive controls appear per entry; archiving is refused while active
   products still reference the entry.

## Create a product

1. Products → company card → New product: SKU (uppercase, digits,
   dashes; unique per company), name, optional category/unit/description.
2. Product starts as **draft** (invisible to operational flows).
3. Open the product page → add variants (variant SKU + one value per
   attribute; duplicate combinations are refused).
4. Upload images (public tier; confidential tier for intelligence
   holders).
5. Intelligence holders fill the Confidential intelligence panel
   (sourcing notes, target cost + currency, remarks).
6. Activate (reason required) → product becomes usable system-wide.

## Archive / reactivate

- Archive product (reason) → variants archive with it; record remains
  forever, no deletes.
- Reactivate product (reason) → variants stay archived until
  individually reactivated.

## CSV import

1. Products → Import → choose company → upload CSV
   (`sku,name,category_code,unit_code,variant_sku,description`).
2. Review the stored plan: creates / updates / rejects with per-row
   reasons. Nothing has been written yet.
3. Apply (writes execute; per-row failures recorded) or Discard.
4. Job history stays listed with counts; every job is audited.

## Who sees what

- Any scoped user: products, variants, categories, units, public images.
- Intelligence permission: + confidential panel, confidential images
  (every view/download audited).
- Import permission: + import ledger.
- Other companies' catalogs: never (RLS-enforced).
