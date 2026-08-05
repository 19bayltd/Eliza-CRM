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
| D-015 | 2026-08-05 | Phase 01 declared **Complete in Staging** by explicit owner instruction, with the sole remaining criterion — a recorded first `login_succeeded` for the owner account — **waived by the owner** (not marked Pass). Context: the owner mailbox is held by the owner's manager; the recovery flow that the sign-in depends on is itself proven live (both other accounts completed it). Residual risk: until the manager performs reset→sign-in, the owner account has no known credential. Follow-up: evidence to be appended to the phase document when the sign-in occurs; automated audit-log watch remains armed | Governance | Owner instruction 2026-08-05; `phases/PHASE_01_SECURE_PLATFORM_FOUNDATION.md` |
| D-016 | 2026-08-05 | Phase 02 (Product Master) activated by owner instruction ("complete phase 2") the same day the waived Phase 01 criterion was satisfied by evidence (owner `login_succeeded` 09:44 UTC — no waivers outstanding) | Governance | Owner instruction 2026-08-05; `phases/PHASE_02_PRODUCT_MASTER.md` |
| D-017 | 2026-08-05 | Phase 02 defaults chosen by implementation (owner may override; none announced at activation): (a) SKU format `^[A-Z0-9][A-Z0-9-]*$`, 3–60 chars, unique per company, no enforced prefix; (b) categories nested one-parent (`parent_id`), codes may contain dashes; (c) confidential intelligence visible to Owner + Administrator only by default; (d) both product-image buckets PRIVATE with 300s signed URLs — the "public" tier means company-internal, open-web exposure deferred to storefront phases; (e) intelligence writes require `products.update` AND `products.intelligence.view`; (f) CSV import ≤2000 rows, validate→apply two-step, no attribute values via CSV in this phase; (g) Manager gets create/update/archive/catalog but NOT intelligence/import/export | Scope/architecture | `modules/products/PRODUCTS_SPEC.md`; migration 20260805110002 |
| D-018 | 2026-08-05 | Phase 02 declared **Complete in Staging** by explicit owner instruction, with two criteria — live manual verification and the live e2e run — **waived by the owner** (not marked Pass). Neither was performed: staging holds zero products and zero `products` audit events. Verified instead: schema/RLS by staging probes, business logic by 47 unit tests, and the diff by adversarial review (2 defects fixed). Residual risk: deployed page rendering, form wiring, and server-action round-trips for the product module are unproven. Follow-up: `tests/e2e/products.spec.ts` (5 specs) written and ready; one command retires the waiver, and its evidence will be appended to the phase document | Governance | Owner instruction 2026-08-05; `phases/PHASE_02_PRODUCT_MASTER.md` |

## Recording rules

- Every entry: what was decided, when, why it matters, and where the
  authority lives.
- Conflicting-document findings are recorded here with impact analysis
  before implementation of the conflicting section stops.
