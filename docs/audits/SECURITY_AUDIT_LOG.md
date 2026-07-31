# Security Audit Log

Chronological record of security reviews. No phase completes with an
unresolved critical finding.

| Date | Phase | Scope | Findings | Severity | Resolution | Reviewer |
|---|---|---|---|---|---|---|
| 2026-07-31 | 00 | Full docs/ tree | No secrets, credentials, tokens, or personal data present; no code or runtime surface introduced | None | — | Implementation engineer |
| 2026-07-31 | 01 | Service-role key handling, RLS coverage, cross-company isolation, suspension blocking, audit append-only, storage privacy, secrets in repo | (1) `app` schema lacked USAGE for authenticated — fixed via migration 20260731100007, found by staging RLS probes; (2) advisors: INFO on audit_log RLS-no-policy — intended deny-all; (3) key confined to server-only module + operator script; no NEXT_PUBLIC_ leakage; .env* ignored | Low/None | (1) Fixed + verified; (2) accepted by design; (3) verified clean | Implementation engineer |
| 2026-07-31 | 01 | Owner bootstrap execution path | Service key absent from implementation environment and REST egress blocked; selected guarded management-channel SQL over a temporary Vercel endpoint (no public surface, no secret exposure, no password material — empty hash forces email-reset entry); guard against double-run verified; audit row written; production re-verified untouched (0 tables/users) | None | Executed and verified | Implementation engineer |
| 2026-07-31 | 01 | Password-reset email failure investigation | Auth logs showed 3x POST /recover -> 500 unexpected_failure ('converting NULL to string is unsupported' on confirmation_token): the SQL owner bootstrap left GoTrue token columns NULL — emails were never attempted (no SMTP handoff, no rate-limit consumption). Fixed by setting the 8 token columns to '' for the owner row; fixture script updated; audit semantics corrected so reset events record Auth-API handoff, never delivery. Secondary finding: GoTrue logged referer http://localhost:3000 on requests from Vercel egress IPs -> NEXT_PUBLIC_APP_URL on Vercel is misconfigured (owner action) | Medium (staging, single row) | Fixed + verified; app-URL fix pending owner | Implementation engineer |
