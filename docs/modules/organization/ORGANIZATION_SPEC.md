# Organization Module — Specification (Phase 01)

## Purpose
Companies, branches, warehouses, and departments — the multi-company backbone all other modules scope against.

## Business owner
System owner.

## Users
Owner (company lifecycle), Administrators (branches/warehouses/departments), all active users (read within scope).

## Entities and tables
`companies`, `branches`, `warehouses`, `departments` (see `supabase/migrations/20260731100001_core_organization.sql`). All carry code (unique per company; companies globally unique), name, status (`active`/`archived`), timestamps, created_by/updated_by. Companies carry `base_currency` (ISO-4217) and `timezone`.

## Relationships
branches/warehouses/departments → companies (restrict delete); warehouses/departments optionally → branches.

## Status workflow
`active → archived` only (controlled archival; no deletes). Archived entities are read-only.

## Permissions
See `ORGANIZATION_PERMISSION_MATRIX.md`. Company create/update/archive is owner-level (create requires a global role grant).

## Approval requirements
None in Phase 01 (all actions audited; archival requires a recorded reason).

## Audit events
See `ORGANIZATION_AUDIT_EVENTS.md`.

## Validation rules
Codes `^[A-Z0-9][A-Z0-9_]*$` (2–40 chars), non-blank names, 3-letter uppercase currency; Zod schemas in `server/validation/organization.ts`; server-side authoritative; child entities validated to belong to the target company.

## File access
None in Phase 01.

## Import/export
None in Phase 01.

## Notifications
None in Phase 01.

## Reports
None in Phase 01 (dashboard lists scoped companies).

## Error handling
Typed `ServiceError`s; duplicate codes → `conflict`; archived parents refuse writes.

## Tests
`ORGANIZATION_TEST_PLAN.md`.

## Completion criteria
Companies/branches/warehouses/departments manageable via admin UI with server-side permission checks, RLS scoping, audit events, and passing tests. Status: implemented in Phase 01.
