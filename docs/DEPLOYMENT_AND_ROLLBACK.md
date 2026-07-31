# Eliza OS — Deployment and Rollback

## 1. Environments

| Environment | App | Database | Purpose |
|---|---|---|---|
| Local development | `next dev` | `eliza-source-crm-staging` | Daily work |
| Preview | Vercel preview | `eliza-source-crm-staging` | Review, integration + e2e |
| Production | Vercel production | `eliza-source-crm-production` | Live (owner-gated) |

Per owner decision D-007 there is no separate development Supabase
project; staging serves development, migration testing, auth/permission/
RLS/storage/audit testing, and preview deployments. Preview never connects
to production Supabase.

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

Supabase staging carries all Phase 01 migrations + seed. Production is
untouched; the gated first production deployment follows
`docs/releases/PHASE_01_PRODUCTION_DEPLOYMENT_PLAN.md` (owner approval
required). Vercel project creation and CI wiring remain owner-side actions
documented there.
