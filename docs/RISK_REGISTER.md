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

## Maintenance

New risks are added when identified during any phase. Severity =
probability × impact judgment. Each phase completion reviews rows whose
review date has arrived.
