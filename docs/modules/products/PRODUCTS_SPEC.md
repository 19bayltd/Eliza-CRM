# Products Module — Specification

**Purpose:** Single source of truth for everything the companies sell:
products, variants, categories, attributes, units, confidential product
intelligence, product images, and validated CSV import.

**Business owner:** Owner (Imran / Eliza Source). **Users:** all roles
(read); Manager+ (write); intelligence restricted (see permissions).

## Entities and tables

| Table | Entity | Notes |
|---|---|---|
| `units` | Unit of measure | per-company, UPPER_SNAKE code, archive-only |
| `categories` | Category (nested) | per-company code (dashes allowed), optional `parent_id`, archive-only; archive refused while active products/children reference it |
| `attributes` / `attribute_values` | Variant characteristics (Size, Color, …) | values unique per attribute; archive-only |
| `products` | Product | per-company unique SKU `^[A-Z0-9][A-Z0-9-]*$`, name, description, category, unit, status `draft/active/archived` |
| `product_variants` | Sellable variation | own per-company unique SKU, same status machine; a non-empty attribute combination is unique within its product (service-enforced). Attribute-less variants carry no combination and are distinguished by SKU alone — bulk import creates them that way |
| `variant_attribute_values` | Variant ↔ value links | one value per attribute per variant |
| `product_intelligence` | **Confidential** sourcing/cost data | 1:1 with product; `numeric(14,2)` cost + ISO currency; RLS requires `products.intelligence.view` |
| `product_images` | Image registry | tier `public` (any scoped user) or `confidential` (intelligence permission); objects in private buckets, signed URLs only |
| `import_jobs` / `import_job_rows` | CSV import ledger | validate → apply/discard; per-row planned action + outcome |

## Status workflow

`draft → active → archived → active` (reactivation allowed; never
draft→archived, never deletes). Archiving a product archives its
variants; a variant cannot be reactivated under an archived product.
Activation/archival require a reason and are audited.

## Permissions

See `PRODUCTS_PERMISSION_MATRIX.md`. Catalog: 8 keys under `products.*`.
Confidential intelligence writes require `products.update` AND
`products.intelligence.view`.

## Import rules

CSV columns (any order): `sku,name,category_code,unit_code,variant_sku,
description`; ≤ 2000 rows; one row per product or per variant. Validation
plans every row (`create_product` / `create_variant` / `update_product` /
`reject` + message) and writes nothing; apply executes the stored plan
row-by-row, records per-row failures, never silently partial. Jobs and
row outcomes are permanently stored.

## File access

Buckets `public-product-images` and `confidential-product-images` — both
PRIVATE, objects served via 300-second signed URLs from the storage
service, which enforces per-bucket permissions and audits every
download. "Public" tier = visible to any scoped company user; open-web
exposure is deferred to the storefront phases.

## Validation

Zod at every boundary, server authoritative: SKU/code formats, name
lengths, cost as decimal string (never float), 3-letter ISO currency,
cross-company reference checks on every client-supplied ID.

## Error handling

Typed ServiceErrors; 23505 → conflict with human message; archived
targets → conflict; foreign-company references → invalid_input;
sensitive failures audited with `result=failure`.

## Audit events

See `PRODUCTS_AUDIT_EVENTS.md`. Confidential values are never copied
into the audit log (field names only). Intelligence reads are audited.

## Tests

See `PRODUCTS_TEST_PLAN.md`. 19 unit tests (SKU, status machine, CSV
parser, import planner) + staging RLS probes + live manual script.
