# Eliza OS Changelog

All notable changes, newest first. Every production release adds an entry.

## [Unreleased]

### 2026-07-31 — Phase 01: Secure Platform Foundation (staging)
- Next.js App Router foundation (strict TS, ESLint, Zod env validation)
- 7 SQL migrations: organization structure, identity/access, append-only
  audit log, private storage foundation, RLS helpers/policies, permission
  and role reference data, app-schema grants — applied to staging
- Auth: email/password, invitations, password reset, protected routes,
  server-side session verification, account-state blocking with auth ban
- Central authorization service (permissions + scopes; global grants);
  16-permission catalog; Owner/Administrator/Manager/Employee/Viewer
- Admin area: organization, users (invite/status/roles/scopes), audit viewer
- Private storage service: validation, 300s signed URLs, audited access
- Tests: 27 unit, env-gated integration, Playwright e2e specs; staging RLS
  verification script + evidence
- Seeded companies: ELIZA_SOURCE (BDT), 19BAY (BDT), ONE_AND_NINE (USD)
- Production untouched; deployment plan prepared (owner-gated)

### 2026-07-31 — Phase 00: Discovery and Governance
- Established complete documentation and governance framework under `docs/`
- Authored 16 root governance documents, phase specifications 00–22,
  module scaffolding (25 modules), ADR framework with ADR-0001
  (technology stack), audit logs, and release documents
- No application code, migrations, or deployments
