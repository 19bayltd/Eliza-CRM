# Phase 01 — Production Deployment Plan (REQUIRES OWNER APPROVAL)

**Status: prepared, NOT executed.** Production
(`eliza-source-crm-production`, project ref `pbyjyamqmbotixahkknu`) was not
modified during Phase 01, per the owner directive. Execute this plan only
after the owner approves.

## What gets deployed

1. Database migrations `20260731100001` … `20260731100007` (additive only;
   no destructive operations).
2. Reference data (inside migration 6): 16 permissions, 5 role templates.
3. Company seed (`supabase/seed/staging_seed.sql`): Eliza Source, 19BAY,
   1 & 9 — idempotent by code.
4. Application: Vercel production project pointed at the production
   Supabase project.
5. One-time owner bootstrap (`scripts/bootstrap-owner.mjs`).

## Preconditions (owner-side)

- [ ] Owner approval of this plan recorded in `docs/DECISION_LOG.md`
- [ ] Vercel production project exists; env vars set:
      `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
      `NEXT_PUBLIC_APP_URL` (production domain),
      `SUPABASE_SERVICE_ROLE_KEY` (production; server-side env only)
- [ ] Supabase production Auth settings: site URL + redirect URLs for
      `/auth/confirm`; SMTP configured for invitation/reset email
- [ ] Production backups confirmed enabled (Supabase dashboard)
- [ ] `docs/releases/RELEASE_CHECKLIST.md` walked through

## Execution order

1. Apply the seven migrations to production in order (Supabase migration
   tooling; same SQL as `supabase/migrations/`).
2. Run the company seed.
3. Verify: 15 public tables with RLS enabled; 5 roles; 16 permissions;
   3 companies; `system-exports` bucket `public=false`; audit append-only
   self-test (Section 5 of `scripts/rls-verification.sql`).
4. Run RLS verification Sections 1–4 + cleanup (Section 6) against
   production, or accept the staging evidence — owner's call; the script is
   non-destructive and cleans up after itself.
5. Deploy the application to Vercel production.
6. Bootstrap the owner account:
   `NEXT_PUBLIC_SUPABASE_URL=<prod> SUPABASE_SERVICE_ROLE_KEY=<prod> node scripts/bootstrap-owner.mjs <owner-email> "<name>"`
7. Owner signs in, sets password, verifies: dashboard shows 3 companies;
   invites the first administrator; confirms audit trail in /admin/audit.
8. Record the release in `docs/audits/RELEASE_AUDIT_LOG.md` and
   `docs/releases/CHANGELOG.md`.

## Rollback

- Application: revert to the previous Vercel deployment (or take the
  project offline — Phase 01 is the first deploy).
- Database: compensating rollback (drops in reverse dependency order —
  only safe while no production business data exists):
  1. `drop table public.file_metadata;` remove `system-exports` bucket
  2. `drop table public.audit_log;`
  3. drop scope tables, `user_roles`, `role_permissions`, `permissions`,
     `roles`, `user_profiles`; drop trigger `on_auth_user_created` on
     `auth.users`; drop type `public.account_status`
  4. drop `departments`, `warehouses`, `branches`, `companies`
  5. `drop schema app cascade;`
- After any production data exists, rollback switches to point-in-time
  restore with owner approval only.

## Explicitly out of scope

- Any change to production before owner approval
- OAuth, MFA enforcement (future phases per D-008)
