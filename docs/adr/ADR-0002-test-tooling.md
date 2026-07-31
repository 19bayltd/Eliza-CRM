# ADR-0002 — Test Tooling: Vitest and Playwright

## Status

Approved

## Context

`TESTING_STRATEGY.md` proposed Vitest + Playwright (decision D-006) pending
ratification at Phase 01 start. The owner's Phase 01 authorization
explicitly directed: "Use Vitest for unit and integration tests, Playwright
for end-to-end tests. Record this decision in the decision log or ADR."

## Decision

- **Vitest** for unit tests (`tests/unit`) and integration tests
  (`tests/integration`, env-gated to run against the staging database).
- **Playwright** for end-to-end tests (`tests/e2e`) against a dev/preview
  deployment connected to staging — never production.

## Alternatives Considered

Jest (slower TS/ESM story), Cypress (heavier, weaker parallelism).

## Consequences

Two Vitest projects (`unit`, `integration`) in `vitest.config.ts`; e2e
needs staging credentials in CI; `npm run verify` = lint + typecheck +
unit + build.

## Security Impact

Integration/e2e credentials are staging-only and provided via CI secrets —
never committed.

## Migration Impact

None.

## Rollback Considerations

Swappable per-layer without schema or app impact.

## Date

2026-07-31

## Approved By

Business owner (Phase 01 authorization directive).
