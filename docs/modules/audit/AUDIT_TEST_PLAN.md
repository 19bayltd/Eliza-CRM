# Audit Module — Test Plan (Phase 01)

## Unit (implemented)
- `sanitizeAuditValue`: redaction of sensitive keys at depth, truncation, arrays, depth limits.

## Database (executed on staging)
- Append-only: UPDATE and DELETE blocked even for the admin connection; selftest row persisted.
- Client access: SELECT on audit_log denied (42501) for authenticated.

## Integration (env-gated)
- Signed-in client cannot read audit_log.

## Manual/CI
- Every admin mutation produces a visible event in /admin/audit (walked through per action during staging validation).
