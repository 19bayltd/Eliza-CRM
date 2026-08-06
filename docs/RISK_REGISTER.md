# Eliza OS — Risk Register

| Risk ID | Description | Affected module | Probability | Impact | Severity | Mitigation | Owner | Status | Review date |
|---|---|---|---|---|---|---|---|---|---|
| R-001 | Cross-company data leakage | All company-scoped modules | Low | Critical | High | RLS on all 15 scoped tables + staging isolation probes passed (Phase 01 evidence); per-phase isolation tests continue | Engineering | Mitigated (monitored) | Each phase completion |
| R-002 | Incorrect inventory balance | inventory | Medium | High | High | Immutable stock ledger; balances derived from ledger; atomic transactions; negative-stock block | Engineering | Open | Phase 05 start |
| R-003 | Duplicate barcode | barcode, inventory, pos | Medium | High | High | Unique constraints on barcodes; import duplicate detection | Engineering | Open | Phase 06 start |
| R-004 | Partial POS transaction | pos, inventory, finance | Low | Critical | High | Single-transaction POS completion with full rollback; rollback tests | Engineering | Open | Phase 07 start |
| R-005 | Unauthorized employee-document access | employees, storage | Low | Critical | High | Highly Confidential classification; narrow permissions; short-lived URLs; every access audited; approval for download where required | Engineering | Open | Phase 01 (storage), Phase 10 (employees) |
| R-006 | Incorrect report mapping (Meta/Amazon/SEO) | reporting, meta, amazon, seo | Medium | Medium | Medium | Import pipeline with preview/validation; traceability to import job and source IDs | Engineering | Open | Phase 13 start |
| R-007 | Destructive migration | All | Low | Critical | High | Migration rules (`DATABASE_ARCHITECTURE.md` §8); destructive ops require approval; clean + realistic-data migration tests in CI | Engineering | Open | Every phase |
| R-008 | Unreliable external API synchronization | integrations, meta, amazon | Medium | Medium | Medium | Idempotent imports; freshness indicators; failure alerting (Phase 19) | Engineering | Open | Phase 15+ |
| R-009 | Developer production access misuse | All | Low | High | Medium | No default production employee-document access; time-bound, justified, audited access | Owner | Open | Phase 01 completion |
| R-010 | Backup restoration failure | All | Low | Critical | High | Production backups enabled at provisioning; restore drill in Phase 21 with interim manual verification once production data exists | Engineering | Open | Phase 21 |
| R-011 | Documentation drift (code diverges from docs) | Governance | Medium | High | High | Step 11 documentation updates mandatory per phase; phase completion gate includes doc review | Engineering | Open | Every phase completion |
| R-012 | Scope creep across phase boundaries | Governance | Medium | Medium | Medium | Phase control in `IMPLEMENTATION_STATUS.md`; excluded-scope lists per phase; owner activation gate | Owner | Open | Every phase start |
| R-013 | Approval threshold is not currency-adjusted: the seeded 500,000 tier applies the same number to BDT and USD companies, so the effective limit differs by ~120x between them | purchasing | High | Medium | High | Thresholds are rows in `approval_rules`, editable per company without deployment; owner to set real per-currency values (open decision) | Owner | **Open** | Before production |
| R-014 | Received goods do not affect stock until Phase 05: `received` means recorded-as-arrived, not in-stock | purchasing, inventory | High | Medium | Medium | Stated in `PURCHASING_SPEC.md` §5 and the phase report; `record_purchase_receipt` is the single designated insertion point for ledger postings, keeping that future write atomic | Engineering | Open | Phase 05 start |
| R-015 | Phase 04 shipped with a single self-review instead of the three independent adversarial reviewers used in Phases 02–03, and the one security-critical finding was caught by tooling rather than that review | purchasing, Governance | Medium | High | High | Independent adversarial pass scheduled before production; advisors run per phase; embed-guard test added to catch the recurring defect class | Engineering | **Open** | Before production |
| R-016 | Documentation drift materialized (R-011 realized): four cross-cutting logs — code, database, security and release audits — were not updated at Phases 02–04 completion despite the code audit log stating an entry is required per phase | Governance | — | Medium | Medium | Backfilled 2026-08-06 with entries marked as such; per-phase completion checklist to include the four audit logs explicitly | Engineering | Mitigated (monitored) | Every phase completion |

## Maintenance

New risks are added when identified during any phase. Severity =
probability × impact judgment. Each phase completion reviews rows whose
review date has arrived.
