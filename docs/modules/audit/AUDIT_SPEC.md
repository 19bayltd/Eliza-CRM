# Audit Module — Specification (Phase 01)

## Purpose
Append-only trail of every sensitive action; the "what happened / who / result" backbone.

## Entities and tables
`audit_log` (migration 20260731100003): actor, company/branch, module.action, entity, sanitized previous/new values, reason, approval reference, request id, user agent, result, failure reason, timestamptz.

## Design
- Append-only for **every** database role: BEFORE UPDATE/DELETE triggers raise; verified on staging.
- No client access at all (RLS enabled, zero policies; privileges revoked). Reads go through `server/services/audit-view.ts` gated by `audit.log.view` per company; writes through `server/audit` (service role).
- Sensitive mutations use critical writes: audit failure aborts the operation. High-volume auth events are non-critical.
- `sanitizeAuditValue` redacts password/token/secret/key-like fields, truncates oversized values.

## Audit events registry
`docs/AUDIT_EVENT_CATALOG.md` (implemented set marked).

## Tests
`AUDIT_TEST_PLAN.md`.

## Completion criteria
Table, service, viewer UI, catalog, and tests in place. Status: implemented in Phase 01.
