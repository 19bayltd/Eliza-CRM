# Storage Module — Specification (Phase 01)

## Purpose
Private file-storage foundation: metadata registry, bucket policy, permission-gated short-lived signed URLs, audited access.

## Entities and tables
`file_metadata` (migration 20260731100004) + private bucket `system-exports`. Module buckets arrive with their phases per `docs/FILE_STORAGE_POLICY.md`.

## Design
- Buckets are private; no storage.objects policies for clients → browser can never touch objects directly; all access flows through `server/storage` (service role) after `storage.file.upload/download` + company-scope checks.
- Paths embed scope: `<companyId>/<module>/<uuid>_<name>`; a path/company mismatch is refused (defense in depth).
- Upload validation: size cap, MIME allow-list per bucket, sanitized names; metadata row per object; storage+metadata kept consistent (failed metadata insert removes the object).
- Signed URLs: 300 s for `system-exports`. Every upload/download/delete audited.
- Deletes are soft (metadata `status='deleted'`) with object removal.

## Tests
`STORAGE_TEST_PLAN.md`.

## Completion criteria
Bucket private, metadata registry live, service enforcing validation + audit. Status: implemented in Phase 01 (service layer; first UI consumer arrives with exports in later phases).
