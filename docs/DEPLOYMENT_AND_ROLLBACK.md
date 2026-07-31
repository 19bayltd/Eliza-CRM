# Eliza OS — Deployment and Rollback

## 1. Environments

| Environment | App | Database | Purpose |
|---|---|---|---|
| Development | Vercel dev / local | Supabase development project | Daily work |
| Preview/Staging | Vercel preview | Supabase staging project (where required) | Review + e2e |
| Production | Vercel production | Supabase production project | Live |

Environment variables are managed in Vercel/Supabase configuration.
Secrets never enter source control; the browser never receives
service-role keys.

## 2. Deployment flow

1. PR merged to `main` after CI passes (lint, typecheck, tests, build,
   migration validation).
2. Migrations applied to staging; verified.
3. Production deploy: apply migrations, then release the app build.
4. Post-deploy: run smoke checks on critical paths; record in
   `docs/audits/RELEASE_AUDIT_LOG.md` and `docs/releases/CHANGELOG.md`.

Migrations are forward-only in production; destructive operations require
prior owner approval and a tested backup.

## 3. Rollback

- **Application:** redeploy the previous Vercel build (instant).
- **Database:** prefer compensating (reverse) migrations over restores.
  Each migration documents its rollback considerations. Point-in-time
  restore is the last resort and requires owner approval.
- **Storage:** soft-delete model means file rollback is a status change.

Every phase document contains a phase-specific rollback plan; every release
follows `docs/releases/RELEASE_CHECKLIST.md`.

## 4. Backups and continuity

Supabase automated backups enabled on production; restore procedure to be
tested and documented in Phase 21 (Security and Continuity) — with an
interim manual verification scheduled once production data exists
(tracked in `RISK_REGISTER.md` R-010).

## 5. Status

Policy defined in Phase 00. Environment provisioning (Vercel projects,
Supabase projects, CI) is Phase 01 scope and requires owner-supplied
credentials at that time.
