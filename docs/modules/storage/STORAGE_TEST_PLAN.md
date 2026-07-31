# Storage Module — Test Plan (Phase 01)

## Database (executed on staging)
- `system-exports` bucket exists with `public=false`.
- `file_metadata`: RLS company-scoped reads; client writes revoked.

## Unit
- Covered indirectly via permission evaluator; path-building and validation covered by service-level integration tests in CI.

## Integration (staging CI, pending credentials)
- Upload permission denial without storage.file.upload; wrong-company denial; signed URL expiry ≤ 300s; audit rows for each operation.

## Manual
- First UI consumer (exports) arrives in a later phase; until then service is exercised via integration tests.
