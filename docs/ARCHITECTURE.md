# Eliza OS — Architecture

## 1. Overview

Eliza OS is a Next.js (App Router) application backed by Supabase
(PostgreSQL, Auth, Storage), deployed on Vercel, developed in a private
GitHub repository. It is a modular monolith: one application, one database,
with strict module boundaries expressed in the repository layout, the
database schema, and the permission model.

```
Browser ── Next.js (Vercel) ──┬── Server Components / Route Handlers / Server Actions
                              │        │
                              │        ├── server/ services (permissions, audit, validation)
                              │        │
                              │        └── Supabase (PostgreSQL + RLS, Auth, Storage)
                              │
                              └── Client Components (interaction only, no trusted logic)
```

## 2. Repository structure (approved)

```
app/            Next.js App Router routes
components/     Shared presentational components
features/       Feature modules (UI + client logic per domain)
lib/            Shared utilities
server/         Server-only services
  auth/
  permissions/
  audit/
  database/
  storage/
  validation/
  services/
  integrations/
supabase/
  migrations/   Version-controlled SQL migrations
  seed/         Deterministic seed data (non-production)
  functions/    Edge functions (if approved per use case)
docs/           Implementation authority (this documentation)
tests/          Unit / integration / e2e tests
scripts/        Repeatable maintenance and CI scripts
types/          Shared TypeScript types
```

Feature directories under `features/` follow the module list in
`MODULE_ROADMAP.md` (organization, auth, permissions, audit, files,
products, suppliers, purchasing, inventory, barcode, pos, crm, orders,
employees, tasks, finance, reporting, initiatives, alerts, ...).

## 3. Layering rules

1. **UI layer** (`app/`, `components/`, `features/*/components`) renders
   state and collects input. It never contains business rules, permission
   decisions, or direct privileged database access.
2. **Server layer** (`server/`, server actions, route handlers) is the only
   place that:
   - verifies authentication, account status, role, permission, and scope;
   - executes privileged reads/writes;
   - writes audit records;
   - accesses storage with service credentials.
3. **Database layer** enforces the last line of defense: RLS policies,
   constraints, foreign keys, and unique indexes. A bug in the server layer
   must not be able to leak cross-company data past RLS.

Centralized services (one implementation, reused everywhere):
- `server/permissions` — permission checks
- `server/audit` — audit event writing
- `server/validation` — Zod schemas shared by client forms and server
  boundaries (server-side validation is authoritative)

## 4. Multi-company model

All business data is scoped by `company_id` and, where applicable,
`branch_id`, `warehouse_id`, and `department_id`. User access is granted
explicitly per scope (see `ROLE_PERMISSION_MATRIX.md`). Client-supplied
scope identifiers are never trusted; the server resolves the caller's
allowed scopes and validates every request against them.

## 5. Environments

| Environment | App | Database |
|---|---|---|
| Development | Vercel dev / local | Supabase development project |
| Staging/Preview | Vercel preview | Supabase staging project (where required) |
| Production | Vercel production | Supabase production project |

Secrets live in Vercel/Supabase environment configuration — never in
source control. Service-role keys never reach the browser.

## 6. Cross-cutting concerns

- **Security:** `SECURITY_MODEL.md`
- **Permissions:** `ROLE_PERMISSION_MATRIX.md`
- **Audit:** `AUDIT_EVENT_CATALOG.md`
- **Storage:** `FILE_STORAGE_POLICY.md`
- **Database:** `DATABASE_ARCHITECTURE.md`
- **Testing:** `TESTING_STRATEGY.md`
- **Deployment:** `DEPLOYMENT_AND_ROLLBACK.md`

## 7. Change control

Architectural changes require an ADR in `docs/adr/` approved by the owner.
This document is updated only after the corresponding ADR is approved.
