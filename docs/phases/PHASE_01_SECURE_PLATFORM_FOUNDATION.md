# Phase 01 — Secure Platform Foundation

> **Status: Implemented on staging.** Authorized by the owner on
> 2026-07-31 with approved decisions (Supabase two-project setup, auth
> scope, initial companies, roles, test tooling). Production deployment is
> prepared but **not executed** — see
> `docs/releases/PHASE_01_PRODUCTION_DEPLOYMENT_PLAN.md`.

## Objective

Stand up the secure, multi-company platform foundation: project scaffold,
organization structure, authentication, user profiles, roles and
permissions, audit logging, private storage, and an administration area.

## Business Outcome

The owner can create companies, branches, warehouses, and departments;
invite individual users; assign roles and scopes; suspend access instantly;
and see an audit trail of every sensitive action — with cross-company
isolation enforced at the database level.

## Included Scope (delivered)

- Next.js App Router scaffold, strict TypeScript, ESLint, approved layout
- Environment validation (Zod) with public/server split
- Supabase clients: browser (publishable), server (session-bound),
  service-role (server-only module)
- 7 migrations: core organization, identity/access, audit log, storage
  foundation, RLS helpers + policies, reference data, app-schema grants
- Auth: email/password sign-in, sign-out, password reset (non-enumerating),
  invitations, `/auth/confirm`, set-password, protected routes
  (middleware + server layout), server-side session verification
  (`auth.getUser()`), suspended/locked/disabled/exited blocking
  (application gate + auth-level ban + RLS)
- Account states with a controlled transition machine
- Companies (3 seeded per owner decision), branches, warehouses,
  departments with per-company unique codes and archival-only lifecycle
- Roles (Owner/Administrator/Manager/Employee/Viewer), 16-permission
  catalog, role-permission mappings, user-role assignments (company-bound
  or global), user company/branch/warehouse/department scopes
- Centralized authorization: pure evaluator + `requirePermission` /
  `requireGlobalPermission` / `hasPermission`; RLS parity via `app.*`
  helpers
- Append-only audit log (tamper-blocked for every DB role), central audit
  service with sanitization and critical-write semantics, admin viewer
- Private storage foundation: `system-exports` bucket (private),
  file_metadata registry, upload/download/delete service with validation,
  300-second signed URLs, full audit
- Administration area: organization management, user management (invite,
  status with reason, roles, scopes), audit viewer — loading/empty/error
  states, permission-aware rendering, confirmations on destructive actions
- Owner bootstrap script (one-time, refuses second run)
- Staging seed and staging application of all migrations
- Tests: 27 unit tests, env-gated integration suite, Playwright e2e specs,
  staging SQL RLS verification (`scripts/rls-verification.sql`)

## Excluded Scope (respected)

Products, suppliers, purchasing, inventory transactions, barcodes, POS,
CRM, orders, employee HR records, finance, reporting, dashboards beyond
the foundation, alerts, AI. OAuth and MFA enforcement (per D-008).

## Dependencies

Phase 00 (complete). Owner-side remaining: Vercel projects + CI secrets
(documented in the deployment plan).

## Database Changes

See `DATABASE_ARCHITECTURE.md` §10 — 7 additive migrations + idempotent
company seed, all applied to staging (`eliza-source-crm-staging`).
Production untouched.

## Permission Requirements

Implemented per `ROLE_PERMISSION_MATRIX.md` §5 (16 permissions, 5 roles).

## Audit Requirements

Implemented per `AUDIT_EVENT_CATALOG.md` §4 (Phase 01 implemented set).

## File-Storage Requirements

Implemented per `FILE_STORAGE_POLICY.md`: private bucket, metadata,
signed URLs, audited access. Module buckets arrive with their phases.

## Backend Requirements

Implemented: all privileged operations server-side behind the central
permission gate; service-role key confined to `lib/supabase/admin.ts`
(`server-only`); no client-supplied scope identifiers trusted (validated
against granted scopes / parent records).

## Frontend Requirements

Implemented per `DEVELOPMENT_WORKFLOW.md` §1 step 8. No fake data.

## Validation Rules

Zod at every boundary; server-side authoritative; per-company unique
codes; digit-leading codes supported (19BAY); 12-char password minimum.

## Approval Rules

No approval engine in Phase 01 (first consumer arrives in Phase 04);
sensitive actions require recorded reasons and are audited.

## Error Handling

Typed `ServiceError` hierarchy; `ActionResult` envelope for UI; no
internals leaked; sensitive failures audited with `result=failure`.

## Security Requirements

See Security Findings in the completion report and
`docs/audits/SECURITY_AUDIT_LOG.md`. Advisors: one INFO finding
(audit_log RLS-no-policy — intended deny-all design).

## Testing Requirements

See Verification Evidence below.

## Migration Plan

Staging applied (evidence below). Production: gated plan in
`docs/releases/PHASE_01_PRODUCTION_DEPLOYMENT_PLAN.md`.

## Rollback Plan

App: previous Vercel build. DB: compensating drops in reverse dependency
order (safe pre-data), documented in the deployment plan; per-migration
rollback notes in each migration header.

## Deliverables

Application code (app/, lib/, server/, components/, types/), 7 migrations
+ seed, bootstrap script, RLS verification script, 4 test files + e2e
specs, 25 module documents for the five foundation modules, updated
governance docs, production deployment plan.

## Completion Criteria

| Criterion | Verdict | Evidence |
|---|---|---|
| Approved scope implemented | Pass | This document + code tree |
| Excluded scope untouched | Pass | No module tables/routes beyond foundation |
| Migrations pass against clean DB | Pass | Applied to empty staging, 7/7 success |
| Permissions enforced server-side | Pass | Central gate + unit matrix (14 tests) |
| Permissions enforced at DB boundary | Pass | Staging RLS probes (below) |
| Cross-company isolation | Pass | User A saw only ELIZA_SOURCE; B only 19BAY |
| Suspended-user blocking | Pass | 0 rows + is_active=false + auth ban on suspend |
| Audit events implemented | Pass | Catalog §4; append-only verified on staging |
| Sensitive storage protected | Pass | Bucket public=false; no client policies; signed URLs 300s |
| Unit tests pass | Pass | 27/27 |
| Lint / typecheck / build pass | Pass | Verification evidence |
| Advisors reviewed | Pass | 1 INFO (intended design), 0 warnings/errors |
| No unresolved critical security issue | Pass | Security review below |
| Documentation updated | Pass | This doc + matrices + module docs + ADRs |
| Rollback documented | Pass | Deployment plan |
| Production untouched | Pass | Zero operations against pbyjyamqmbotixahkknu |
| E2E executed against running app | Pass (unauthenticated set) | 4/4 specs vs local app on staging Supabase; authenticated spec env-gated (service key) |
| Invitation email loop end-to-end | **Deferred** | Requires SMTP/mailbox on staging |

## Open Questions

None blocking. Owner actions pending: Vercel project creation + CI
secrets; approval to execute the production deployment plan.

## Risks

R-001 mitigated (RLS + isolation tests). R-007 mitigated (additive-only).
R-009 note: this implementation session used the Supabase management API
on staging only. R-011/R-012 respected. Register updated.

## Implementation Checklist

- [x] Gap analysis and work-package plan
- [x] WP1 — Project scaffold + tooling
- [x] WP2 — Migrations + RLS + seed (applied to staging)
- [x] WP3 — Auth integration + account states
- [x] WP4 — Permission service
- [x] WP5 — Audit service
- [x] WP6 — Storage foundation
- [x] WP7 — Admin UI
- [x] WP8 — Test suites + staging RLS verification
- [x] WP9 — Documentation updates
- [x] WP10 — Deployment plan + completion report

## Verification Evidence

2026-07-31, staging project `yhrdyyvayistqqwxawqr`:

```
lint:        0 errors, 0 warnings
typecheck:   clean (tsc --noEmit, strict + noUncheckedIndexedAccess)
unit tests:  27 passed / 27 (4 files)
integration: env-gated suite skips cleanly without credentials (5 skipped)
build:       production build OK — 11 routes, middleware bundled

migrations:  7/7 applied to clean staging DB
seed:        3 companies (ELIZA_SOURCE/BDT, 19BAY/BDT, ONE_AND_NINE/USD; Asia/Dhaka)
reference:   5 roles, 16 permissions, 34 role-permission rows
RLS:         enabled on 15/15 public tables; system-exports public=false

Staging RLS probes (scripts/rls-verification.sql):
  A (administrator @ ELIZA_SOURCE): companies_visible=1 [ELIZA_SOURCE];
    audit select DENIED:42501; company insert/update DENIED:42501;
    scope self-grant DENIED:42501; profiles_visible=1 (own row)
  B (employee @ 19BAY): sees only 19BAY; has_permission(view)=true,
    (branch.manage)=false, (users.suspend)=false; sees only own
    role/scope rows
  B suspended: companies_visible=0; is_active=false; has_view=false;
    roles catalog invisible
  audit append-only: UPDATE blocked, DELETE blocked (admin connection);
    selftest row retained
  test users removed after verification (no residue)

E2E (2026-07-31, local dev server → STAGING Supabase, pre-installed
  Chromium): 4/4 unauthenticated specs passed — protected-route
  redirects, login rendering, invalid-credentials error against real
  staging auth, non-enumerating password reset. Authenticated-flow spec
  remains env-gated (needs a full environment with the service-role key,
  which this sandbox intentionally lacks).

Advisors (security): 1 INFO — audit_log RLS-no-policy (intended deny-all).
Secrets: service-role key only in server-only module + operator script;
  no NEXT_PUBLIC_ leakage; .env* gitignored; no client import of admin.
```

## Final Phase Verdict

**Partially Complete** — all in-sandbox completion criteria pass with
evidence; two items are deferred to owner/CI execution (e2e run against a
live staging deployment; invitation email loop), and production deployment
awaits owner approval. No unresolved critical issues.
