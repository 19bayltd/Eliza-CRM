# Security Audit Log

Chronological record of security reviews. No phase completes with an
unresolved critical finding.

| Date | Phase | Scope | Findings | Severity | Resolution | Reviewer |
|---|---|---|---|---|---|---|
| 2026-07-31 | 00 | Full docs/ tree | No secrets, credentials, tokens, or personal data present; no code or runtime surface introduced | None | — | Implementation engineer |
| 2026-07-31 | 01 | Service-role key handling, RLS coverage, cross-company isolation, suspension blocking, audit append-only, storage privacy, secrets in repo | (1) `app` schema lacked USAGE for authenticated — fixed via migration 20260731100007, found by staging RLS probes; (2) advisors: INFO on audit_log RLS-no-policy — intended deny-all; (3) key confined to server-only module + operator script; no NEXT_PUBLIC_ leakage; .env* ignored | Low/None | (1) Fixed + verified; (2) accepted by design; (3) verified clean | Implementation engineer |
