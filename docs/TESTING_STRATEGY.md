# Eliza OS — Testing Strategy

## 1. Test layers

| Layer | Scope | Tooling (confirmed in Phase 01 via ADR if deviating) |
|---|---|---|
| Unit | Pure logic, validation schemas, services with mocked boundaries | Vitest |
| Integration | Server services against a real (local/branch) Supabase database, RLS policies, migrations | Vitest + Supabase local |
| End-to-end | Critical user paths in the running app | Playwright |
| Migration checks | Each migration on a clean DB and on realistic data | CI script |
| Permission/authorization | Every protected operation, positive and negative | Integration layer |

## 2. Minimum cases per protected operation

Every protected operation is tested for:

- Successful operation
- Invalid input
- Missing required input
- Unauthorized user (lacking the permission)
- Suspended user
- Wrong company
- Wrong branch (where scoped)
- Wrong warehouse (where scoped)
- Wrong department (where scoped)
- Invalid status transition
- Duplicate submission (idempotency)
- Transaction rollback (forced mid-operation failure leaves no partial records)
- Audit-log creation
- File-access restrictions (where applicable)
- Export restrictions (where applicable)

## 3. Cross-company isolation tests

Dedicated suite: for each company-scoped table and endpoint, a user granted
Company A must receive zero rows / a rejection for Company B data — both
through the API layer and directly against RLS.

## 4. Verification gate (every phase)

Run and record: lint, typecheck, unit, integration, e2e, production build,
migration validation, dependency check, permission tests, cross-company
isolation tests, and manual critical-path checks. Evidence is pasted into
the phase document's **Verification Evidence** section and the relevant
`docs/audits/` log.

## 5. Test data

- Deterministic seed data in `supabase/seed/` for development and tests.
- No production data in tests. No fake data in production.

## 6. Status

Strategy defined in Phase 00. Tooling installation and the first suites are
Phase 01 scope.
