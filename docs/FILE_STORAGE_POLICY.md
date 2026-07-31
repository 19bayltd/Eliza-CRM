# Eliza OS — File Storage Policy

## 1. Buckets / namespaces

Separated buckets (Supabase Storage), created as their phases require them:

| Bucket | Classification | Access |
|---|---|---|
| `public-product-images` | Public | Public read; authorized write |
| `confidential-product-images` | Confidential | Signed URLs, permissioned |
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

Policy defined in Phase 00. Bucket provisioning, metadata table, server
storage service, and audit wiring are Phase 01 scope (private storage
foundation); additional buckets arrive with their modules.
