# Release Audit Log

Chronological record of releases: version, environment, migrations
applied, checklist evidence, smoke-check results, rollback readiness.

| Date | Release | Environment | Migrations | Checklist | Smoke checks | Notes |
|---|---|---|---|---|---|---|
| 2026-08-06 | Phases 01–04 (continuous deploy from `main`) | Staging only — `eliza-crm.vercel.app` + Supabase `yhrdyyvayistqqwxawqr` | 18 applied (7 P01, 2 P02, 2+2 P03, 3+2 P04) | Lint/typecheck/build/tests green on every push; per-phase criteria tables in `phases/` | Owner-run browser verification: Phase 02, Phase 03 (9/9), Phase 04 (request→approval→order→receipt→sample) | **Backfilled 2026-08-06** — individual staging deploys were not logged as they happened. Production: no release, not authorized; rollback = previous Vercel build + per-migration compensating steps |
