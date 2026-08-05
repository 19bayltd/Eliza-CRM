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
| E2E executed against running app | Pass (unauthenticated set, local) | 4/4 middleware/UI specs on the merged commit; live run from an internet-connected machine still pending (sandbox network policy) |
| Live deployment verified (eliza-crm.vercel.app) | Pass | Live manual verification 2026-08-05 (owner-operated, DB-corroborated): login, admin pages, org write, invite cycle, suspension — see Live Verification Addendum II |
| Owner account bootstrapped and working | Partial — password set, sign-in pending | Password set via the app's own recovery flow 2026-08-01 13:08 UTC (`user.password_reset_requested` → `user.password_changed`); the credential holder (mailbox owner) has not yet performed a recorded `login_succeeded` |
| Live app→Supabase connectivity since env edits | Pass | Restored 2026-08-01 after Vercel env fix; proven by app-originated (node UA) gateway traffic and by every live flow recorded since (logins, resets, invites, audit writes) |
| Invitation flow live | Pass | 2026-08-05 08:33–08:35 UTC: `user.invited` → link verified → set-password → `user.activated`; final state active, employee @ ELIZA_SOURCE (DB-verified) |
| Invitation email loop end-to-end | Pass | Invite + recovery emails delivered by staging SMTP and consumed via the scanner-proof interstitial (recovery 2026-08-01, invite 2026-08-05 after the invite template was aligned with the recovery template) |
| Suspension blocks live login | Pass | 2026-08-05 08:38–08:45 UTC: `user.status_changed` (suspended, with reason) → login attempt recorded as `user.login_blocked` / `account_banned` (auth-level ban path) |

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

E2E (2026-07-31, local server, pre-installed Chromium): 4/4
  unauthenticated specs passed — protected-route redirects, login
  rendering, invalid-credentials error path, non-enumerating password
  reset. CORRECTION (recorded 2026-07-31, post-merge): the sandbox
  network policy blocks egress to Supabase REST/auth, so these specs
  validate middleware and UI error handling only — they do NOT prove a
  round-trip to staging auth. Authenticated-flow spec remains env-gated
  (needs service-role key runtime).

Advisors (security): 1 INFO — audit_log RLS-no-policy (intended deny-all).
Secrets: service-role key only in server-only module + operator script;
  no NEXT_PUBLIC_ leakage; .env* gitignored; no client import of admin.
```

## Live Verification Addendum (2026-07-31, post-merge)

Merged to `main` at `1021a0e` (PR #1); merge tree byte-identical to
`f243dc3` (verified: empty diff). Live URL reported as
https://eliza-crm.vercel.app.

Verified from this environment:
- Merged `main` locally: lint 0/0, typecheck clean, unit 27/27,
  production build OK, e2e 4/4 (middleware/UI layer).
- Client-bundle secret scan of the production build of `main`: no
  `sb_secret` / service-role / `SUPABASE_SERVICE_ROLE_KEY` patterns in
  any `.next/static` chunk.
- Staging DB via management API: schema/seed/reference data intact;
  `system-exports` still private.
- Production project: still zero migrations, zero tables, zero users.

NOT verifiable from this environment (network policy denies all egress to
Vercel and Supabase REST/auth endpoints — curl, Node fetch, and WebFetch
all rejected): any HTTP interaction with the live deployment, live
authentication/reset/invitation flows, live admin pages, live audit
writes, live storage authorization, the deployed bundle, and the Vercel
project's environment configuration.

Independent hard finding: staging contains **no users at all** — the
owner bootstrap has never run, so no one has yet authenticated against
the live deployment; live-flow criteria are not just unverified from
here, they cannot yet be true for anyone.

## Live Verification Addendum II (2026-08-01 → 2026-08-05)

All items below were performed by the owner's operator in a real browser
against https://eliza-crm.vercel.app and corroborated from the staging
database (audit_log + auth schema) by the implementation session. Times
UTC.

Connectivity (2026-08-01): after the owner corrected the Vercel
environment variables, app-originated traffic (user-agent `node`)
reappeared in the API gateway logs; every event below is app-originated.

- Password recovery through the app: `user.password_reset_requested`
  (provider handoff accepted) → interstitial → `user.password_changed`
  for both the owner account (08-01 13:07–13:08) and the administrator
  account (08-01 12:47).
- Login/logout cycle: multiple `user.login_succeeded` /
  `user.signed_out` events (administrator account); wrong-password
  attempts recorded as `user.login_failed` / `invalid_credentials`.
- Protected routes: unauthenticated visits to /dashboard and
  /admin/users redirect to /login with no data flash (manual, 08-05).
- Admin pages render with real data as Administrator: organization
  (3 companies), users (accounts, statuses, roles, scopes), audit
  viewer (paginated recent events) — manual, 08-05.
- Organization write + audit: branch TEST35 created via UI →
  `organization / branch.created` with actor + values (08-05 08:01).
- Owner-only boundary: as Administrator, company create/update/archive
  controls absent (permission-aware rendering); branch/warehouse/
  department management available (08-05, screenshots).
- Invitation cycle (08-05 08:33–08:35): `user.invited`
  (admanager.1and9@gmail.com, employee @ ELIZA_SOURCE, actor
  administrator) → invite email delivered → scanner-proof interstitial →
  set-password → `user.activated`; DB end-state: account_status=active,
  employee role, single ELIZA_SOURCE scope, last_sign_in_at recorded.
  Prerequisite fix: the *Invite user* email template was aligned with
  the recovery template (`{{ .SiteURL }}/auth/confirm?token_hash=
  {{ .TokenHash }}&type=invite&next=/set-password`); the prior default
  template produced fragment-based links that expired unusably
  (recorded incident, 08-05 morning).
- Suspension (08-05 08:38–08:45): `user.status_changed` active→suspended
  with reason → suspended login attempt rejected; after commit 3b46ce9
  the rejection is recorded truthfully as `user.login_blocked` /
  `account_banned` and surfaces "This account is not active" (the
  auth-level ban fires before the application account-state gate).
- Stale-invitation handling: expired pending invitations were removed
  (audited `user.invitation_deleted`), and the admin UI gained
  Resend/Delete invitation actions (commit 76c4dd2) so recovery from
  expired invites no longer requires database access.

Corrections/fixes landed during live verification: 76c4dd2
(resend/delete pending invitations), 3b46ce9 (banned-account sign-in
message + truthful audit reason), diagnostic removal (this commit).
Production project: still zero migrations, tables, and users (re-verified
2026-08-05).

## Final Phase Verdict

**Partially Complete — two evidence items from "Complete in Staging".**
All code-, schema-, security-, and live-flow criteria now pass with
recorded evidence. Remaining gate:
(1) one recorded `login_succeeded` for the owner account — the mailbox
holder must complete /forgot-password → set password → sign in;
(2) the live e2e suite from an internet-connected machine:
`BASE_URL=https://eliza-crm.vercel.app E2E_USER_EMAIL/PASSWORD=<admin
test account> npm run test:e2e`.
No unresolved critical issues. Temporary diagnostics (/api/diag probe,
token-fingerprint logging) have been removed from the codebase.
