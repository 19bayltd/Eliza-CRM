# Permissions Module — Test Plan (Phase 01)

## Unit (implemented — tests/unit/evaluate-permission.test.ts)
14 cases: scoped allow; no-scope deny; wrong-company deny; role-bound-to-other-company deny; global grant allow; all five non-active states deny; missing permission; global-grant requirement; missing company target; branch narrowing (unrestricted/mismatch/match).

## Database (executed on staging)
`app.has_permission` true/false parity for employee vs administrator; self-grant of scopes denied at RLS.

## Integration (env-gated)
Signed-in client cannot read others' role/scope rows.
