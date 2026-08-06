# Eliza OS — File Storage Policy

## 1. Buckets / namespaces

Separated buckets (Supabase Storage), created as their phases require them:

| Bucket | Classification | Access |
|---|---|---|
| `public-product-images` | Internal (company-public) | PRIVATE bucket, signed URLs for any scoped company user (D-017: open-web exposure deferred to storefront phases; becomes Public then) |
| `confidential-product-images` | Confidential | Signed URLs, permissioned (`products.intelligence.view`), access logged |
| `supplier-documents` | Confidential | Signed URLs, permissioned, access logged |
| `employee-documents` | Highly Confidential | Signed URLs, narrow permission, every access logged, approval where required |
| `report-imports` | Confidential | Server-side only |
| `system-exports` | Confidential | Signed URLs, permissioned, access logged |

## 2. Rules

- Private files never use permanent public URLs; use short-lived signed
  URLs (target TTL ≤ 5 minutes for Highly Confidential, ≤ 1 hour
  otherwise; finalized per module spec).
- Every sensitive file access (upload/download/delete) is audited
  (`storage.file.*` events).
- Storage service keys never reach the browser. All privileged storage
  operations go through `server/storage`.
- Object paths embed scope: `<company_id>/<module>/<entity_id>/<filename>`
  so scope checks can be enforced structurally.

## 3. Validation (on every upload)

- File type, extension, and MIME type (allow-list per bucket)
- File size limit (per bucket, defined in module specs)
- Upload authorization (permission + scope)
- Record ownership and company scope of the linked entity

Downloads validate the same authorization plus data classification.

## 4. Metadata

Each stored file has a database metadata row: id, bucket, path, company
scope, linked entity, classification, size, MIME type, uploaded_by,
uploaded_at, status. Deletions are soft (status change) unless a retention
rule approves purge.

## 5. Status

Policy defined in Phase 00. Phase 01 delivered the metadata table,
server storage service, audit wiring, and `system-exports`. Phase 02
(2026-08-05) provisioned `public-product-images` and
`confidential-product-images` (both private; per-bucket
upload/download permissions in `server/storage`; image/*, 10 MB, 300 s
signed URLs). Phase 03 (2026-08-06) provisioned `supplier-documents`
(confidential; 25 MB; pdf/image/office; upload gated by
`suppliers.document.manage`, download by `suppliers.document.download`,
every download audited). Remaining buckets arrive with their modules.
