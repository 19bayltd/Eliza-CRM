# Eliza OS — Decision Log

Running log of significant decisions. Architectural decisions get a full
ADR in `docs/adr/`; this log indexes them and records notable
non-architectural decisions.

| # | Date | Decision | Type | Reference |
|---|---|---|---|---|
| D-001 | 2026-07-31 | Adopt the approved technology stack (Next.js App Router + TypeScript, Supabase, Vercel, Zod, ESLint/strict TS) | Architectural | ADR-0001 |
| D-002 | 2026-07-31 | Repository documentation under `docs/` is the implementation authority; document-driven development is mandatory | Governance | Master spec §4; `docs/README.md` |
| D-003 | 2026-07-31 | Phase 00 (Discovery and Governance) executed first because the repository contained no documentation; no code written in Phase 00 | Process | `phases/PHASE_00_DISCOVERY_AND_GOVERNANCE.md` |
| D-004 | 2026-07-31 | Permission model is permission-based (roles are permission bundles); code never hard-codes role names for authorization | Architectural (baseline) | `ROLE_PERMISSION_MATRIX.md` |
| D-005 | 2026-07-31 | Inventory will use an immutable stock ledger; balances never directly editable | Architectural (baseline) | `DATABASE_ARCHITECTURE.md` §5 |
| D-006 | 2026-07-31 | Vitest + Playwright proposed as default test tooling; to be ratified (or replaced via ADR) at Phase 01 start | Proposal | `TESTING_STRATEGY.md` |

## Recording rules

- Every entry: what was decided, when, why it matters, and where the
  authority lives.
- Conflicting-document findings are recorded here with impact analysis
  before implementation of the conflicting section stops.
