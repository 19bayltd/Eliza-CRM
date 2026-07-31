# Eliza OS — Development Workflow

## 1. Document-driven cycle

For every phase, follow this exact sequence (no skipping):

1. **Read and inspect** — master spec, active phase spec, related module
   specs, database architecture, permission matrix, security model, audit
   catalog, existing migrations, source, tests, and implementation status.
   Inspect the repository; never assume it is unchanged.
2. **Gap analysis** — existing/missing/incomplete functionality, security
   concerns, schema conflicts, migration concerns, missing tests, missing
   documentation, dependencies on future phases.
3. **Implementation plan** — small, independently testable work packages.
4. **Database changes** — version-controlled migrations only (rules in
   `DATABASE_ARCHITECTURE.md` §8).
5. **Server-side logic** — sensitive operations server-side only.
6. **Permission checks** — the full 12-point check list in
   `ROLE_PERMISSION_MATRIX.md` §1.
7. **Audit logging** — per `AUDIT_EVENT_CATALOG.md`.
8. **Interface** — loading/empty/error states, validation feedback,
   permission-aware actions, confirmation for destructive actions, mobile
   usability where required, accessible labels, status and data-freshness
   indicators, no fake or hard-coded production data.
9. **Tests** — per `TESTING_STRATEGY.md`.
10. **Verification** — lint, typecheck, unit/integration/e2e, production
    build, migration validation, dependency check, permission tests,
    cross-company isolation tests, manual critical-path checks.
11. **Documentation updates** — phase doc, module docs, database
    architecture, permission matrix, audit catalog, implementation status,
    decision log, risk register, changelog, test evidence, deployment
    notes.
12. **Final phase report** — then **stop**; the owner authorizes the next
    phase.

## 2. Git practice

- Branch per work stream; no direct commits to `main`.
- Focused commits with clear, descriptive messages; unrelated modules are
  not combined; no unnecessary repo-wide reformatting.
- Before editing: inspect current files and `git status`, identify
  concurrent changes, preserve unrelated work.
- After implementing: review the diff; remove debugging code, temporary
  files, and fake data.

## 3. CI requirements (established in Phase 01)

Every push runs: lint, typecheck, unit + integration tests, production
build, migration validation. E2E runs on preview deployments. A failing
check blocks merge.

## 4. Change management

- Conflicting approved requirements → record, explain impact, stop that
  section, request an architecture decision (never guess).
- Architectural decisions → ADR (`docs/adr/`), owner approval.
- Notable non-architectural decisions → `DECISION_LOG.md`.
- New risks → `RISK_REGISTER.md`.

## 5. Stop conditions

Implementation stops (and escalates to the owner) only for: conflicting
approved requirements, destructive data changes, missing critical security
decisions, missing required production credentials, irreversible
architecture decisions, or scope materially exceeding the active phase.
Minor file-level decisions do not require confirmation.
