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

| D-007 | 2026-07-31 | Two Supabase projects only: `eliza-source-crm-staging` (dev/preview/testing) and `eliza-source-crm-production`; no third dev project. Production untouched during Phase 01 | Infrastructure | Owner Phase 01 authorization |
| D-008 | 2026-07-31 | Phase 01 auth = email/password, invitations, reset, protected routes, server session verification, suspended/disabled blocking. No OAuth. MFA architecture prepared, not implemented | Scope | Owner Phase 01 authorization; `modules/authentication/` |
| D-009 | 2026-07-31 | Role templates: Owner, Administrator, Manager, Employee, Viewer (keys: owner/administrator/manager/employee/viewer); authorization strictly via permissions + scopes | Architecture | Owner Phase 01 authorization; migration 20260731100006 |
| D-010 | 2026-07-31 | Vitest + Playwright ratified | Tooling | ADR-0002 |
| D-011 | 2026-07-31 | Global role grants modeled as `user_roles.company_id = null`; they widen role applicability but never bypass explicit company scopes; granting them requires global authority | Architecture | `modules/permissions/PERMISSIONS_SPEC.md` |
| D-012 | 2026-07-31 | Audit writes are critical for sensitive mutations (failure aborts the operation); non-critical only for high-volume auth telemetry | Architecture | `server/audit/index.ts`; `modules/audit/` |
| D-013 | 2026-07-31 | Owner bootstrap is a one-time service-key script (`scripts/bootstrap-owner.mjs`) that refuses to run once any owner exists | Security | `modules/authentication/` |
| D-014 | 2026-07-31 | Owner bootstrap executed via guarded SQL over the authenticated Supabase management channel (staging only) instead of running the service-key script or deploying a temporary bootstrap endpoint: no secrets in the implementation environment, no public attack surface, empty password hash so account entry is only via the owner's email reset flow; same refuse-if-owner-exists guard | Security | `audits/SECURITY_AUDIT_LOG.md`; audit_log `user.bootstrap_owner` |

## Recording rules

- Every entry: what was decided, when, why it matters, and where the
  authority lives.
- Conflicting-document findings are recorded here with impact analysis
  before implementation of the conflicting section stops.
