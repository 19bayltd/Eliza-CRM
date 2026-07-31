# Phase 01 — Secure Platform Foundation

> **Status: Not activated.** This specification is ready for owner review.
> Implementation may begin only after `IMPLEMENTATION_STATUS.md` declares
> Phase 01 active and the Open Questions below are answered.

## Objective

Stand up the secure, multi-company platform foundation: project scaffold,
organization structure, authentication, user profiles, roles and
permissions, audit logging, private storage, and an administration area.

## Business Outcome

The owner can create companies, branches, warehouses, and departments;
invite individual users; assign roles and scopes; suspend access instantly;
and see an audit trail of every sensitive action — with cross-company
isolation guaranteed at the database level.

## Included Scope

- Next.js (App Router, strict TypeScript) project scaffold with approved
  repository structure (`ARCHITECTURE.md` §2), ESLint, formatting, CI
- Supabase projects (dev + production; staging if owner requires),
  migration tooling, seed framework
- Core schema: companies, branches, warehouses, departments, user
  profiles, roles, permissions, role_permissions, user_roles, user scope
  grants, audit_log, file metadata; RLS on all scoped tables
- Supabase Auth integration: invitation flow, sign-in, account states
  (Invited/Active/Suspended/Locked/Disabled/Exited)
- Central `server/permissions` service implementing the 12-point check
- Central `server/audit` service; Phase 01 events per
  `AUDIT_EVENT_CATALOG.md` §4
- Private storage foundation: bucket provisioning, metadata table,
  `server/storage` service, signed-URL access, access audit
- Administration area UI: organization management, user management
  (invite, roles, scopes, suspend), audit log viewer — with loading/empty/
  error states and permission-aware actions
- Test suites per `TESTING_STRATEGY.md` including cross-company isolation
- Module documentation for organization, authentication, permissions,
  audit, storage

## Excluded Scope

Product master, suppliers, purchasing, inventory, barcode, POS, CRM,
orders, employees (beyond user↔employee linkage placeholder), tasks,
finance, reporting, initiatives, external integrations, AI.

## Dependencies

- Phase 00 complete (done)
- Owner-provided: GitHub repo settings, Vercel account/projects, Supabase
  organization/projects and credentials
- Open Questions below resolved

## Database Changes

Initial migrations creating the core schema above, with FKs, unique
constraints (per-company codes), `timestamptz` audit columns, RLS
policies, and seed data for baseline roles/permissions
(`ROLE_PERMISSION_MATRIX.md` §3–5). Exact DDL is designed at phase start
and documented in `DATABASE_ARCHITECTURE.md` §10 upon implementation.

## Permission Requirements

Phase 01 permission set per `ROLE_PERMISSION_MATRIX.md` §5, enforced
server-side and by RLS; finalized (with any additions) in the phase gap
analysis.

## Audit Requirements

All events in `AUDIT_EVENT_CATALOG.md` §4 (Phase 01 table). Audit table is
append-only; no application update/delete path.

## File-Storage Requirements

`FILE_STORAGE_POLICY.md`: provision the private storage foundation and
metadata table; public buckets deferred to their modules.

## Backend Requirements

Server-only services: auth/session handling, permissions, audit, storage,
validation (Zod), organization and user management services. No privileged
operation callable without the 12-point check.

## Frontend Requirements

Admin area per Included Scope, meeting `DEVELOPMENT_WORKFLOW.md` §1 step 8
interface standards. No fake data.

## Validation Rules

Zod schemas for every input boundary; server-side validation
authoritative. Unique, per-company codes for org entities; email
validation on invitations.

## Approval Rules

No configurable-approval engine in Phase 01 (arrives with first approving
module) unless owner directs otherwise; user suspension and role changes
are owner/admin permissions with audit, not approvals.

## Error Handling

Explicit typed errors from services; no silent failures; user-facing
errors never leak internals; all failures of sensitive actions audited
with `result=failure`.

## Security Requirements

Full `SECURITY_MODEL.md` compliance. Notables: RLS on every scoped table;
service-role key server-only; no secrets in repo (`.env.example` names
only); suspension invalidates access immediately.

## Testing Requirements

`TESTING_STRATEGY.md` §2 case list for every protected operation;
cross-company isolation suite; migration checks on clean DB; e2e for
invite→activate→sign-in→admin flows.

## Migration Plan

Migrations applied dev → staging (if present) → production per
`DEPLOYMENT_AND_ROLLBACK.md`. First production apply happens only at
owner-approved go-live.

## Rollback Plan

App: previous Vercel build. DB: compensating migrations; Phase 01 is
additive-only (no destructive ops), so rollback = drop-new-objects
migration documented alongside each forward migration.

## Deliverables

Working foundation deployed to development; CI green; module docs for the
five foundation modules; updated cross-cutting docs; phase completion
report.

## Completion Criteria

- All included scope implemented; excluded scope untouched
- Migrations pass clean-DB validation
- Permissions enforced server-side and via RLS with passing tests
- All Phase 01 audit events firing with tests
- Private storage protected (no public URLs; access audited)
- Full verification gate green (lint, typecheck, unit, integration, e2e,
  build, migration validation, dependency check, isolation tests)
- No unresolved critical security issue
- Documentation updated; rollback documented; manual verification recorded
- Each criterion individually marked Pass/Fail with evidence

## Open Questions

1. Supabase org/projects: create new dev + prod projects? Staging project
   required now or deferred?
2. Vercel account/team and project naming?
3. Auth methods for launch: email+password with email invitations only, or
   also OAuth (Google)? MFA requirement at launch?
4. Initial companies to seed: Eliza Source, 19BAY, 1 & 9 — confirm legal
   names and base currencies.
5. Confirm baseline roles (`ROLE_PERMISSION_MATRIX.md` §3) or supply the
   real starting role list.
6. Test tooling: confirm Vitest + Playwright proposal (D-006).

## Risks

R-001 (cross-company leakage), R-005 (employee-document access — storage
foundation), R-007 (destructive migration), R-009 (developer production
access), R-011, R-012. See `RISK_REGISTER.md`.

## Implementation Checklist

- [ ] Gap analysis and work-package plan (per required response format)
- [ ] WP1 — Project scaffold + CI
- [ ] WP2 — Core schema migrations + RLS + seed
- [ ] WP3 — Auth integration + account states
- [ ] WP4 — Permission service
- [ ] WP5 — Audit service
- [ ] WP6 — Storage foundation
- [ ] WP7 — Admin UI
- [ ] WP8 — Test suites
- [ ] WP9 — Documentation updates
- [ ] WP10 — Final audit + completion report

## Verification Evidence

None yet — phase not started.

## Final Phase Verdict

Not started — awaiting owner activation.
