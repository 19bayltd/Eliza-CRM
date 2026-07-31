# Release Checklist

Complete every item, in order, for every production release. Record the
completed checklist in `docs/audits/RELEASE_AUDIT_LOG.md`.

## Before release
- [ ] CI green on `main` (lint, typecheck, unit, integration, build)
- [ ] E2E suite green on preview deployment
- [ ] Migration validation passed (clean DB + realistic data)
- [ ] No destructive migration without recorded owner approval
- [ ] Security review of the diff (secrets, permissions, RLS coverage)
- [ ] `docs/releases/CHANGELOG.md` updated
- [ ] Rollback plan for this release confirmed (previous build + compensating migrations identified)
- [ ] Backup verified current (production)

## Release
- [ ] Apply migrations to production
- [ ] Deploy application build
- [ ] Run smoke checks on critical paths (sign-in, permission denial, audit write, one core flow per active module)

## After release
- [ ] Record results in `RELEASE_AUDIT_LOG.md`
- [ ] Monitor logs/alerts for the agreed window
- [ ] File follow-up issues for any non-blocking findings
