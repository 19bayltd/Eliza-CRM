# Database Audit Log

Chronological record of database audits: migration reviews, constraint and
RLS coverage checks, destructive-operation approvals.

| Date | Phase | Migrations reviewed | Findings | Resolution | Reviewer |
|---|---|---|---|---|---|
| 2026-07-31 | 00 | None exist | Database rules established in DATABASE_ARCHITECTURE.md; first migrations arrive in Phase 01 | — | Implementation engineer |
| 2026-07-31 | 01 | 20260731100001–20260731100007 | All additive; FKs/uniques/checks present; RLS on 15/15 tables; append-only audit verified (UPDATE/DELETE blocked); applied to clean staging DB; company seed idempotent | Applied to staging; production gated on owner approval | Implementation engineer |
| 2026-08-06 | 02–03 | 20260805110001–110002, 20260806120001–120002, 20260806130001–130002 — **backfilled 2026-08-06** | All additive; RLS on every new table; client writes revoked. Hardening: composite `(id, company_id)` parent keys and FKs across organization/product/supplier domains; `supplier_quotation_costs` and `product_intelligence` made deny-all (server-only) | Applied to staging and verified by probes; negative probe confirms a mis-stamped child row is rejected | Implementation engineer |
| 2026-08-06 | 04 | 20260806140001–140005 | 12 additive tables with composite company FKs, permission-gated RLS, client writes revoked; two SECURITY DEFINER functions (numbering, atomic receiving). Findings: (1) `revoke execute … from anon, authenticated` left PostgreSQL's default PUBLIC grant intact, so both functions were callable unauthenticated via `/rest/v1/rpc`; (2) the receipt function trusted the caller's accepted/extra split, letting over-receipt inflate accepted quantities | (1) revoked from PUBLIC, granted to service_role only — advisors re-run clean; (2) function now computes the outstanding quantity and forces surplus into `extra`; both verified by staging probes | Implementation engineer |
