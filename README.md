# Eliza OS

Eliza OS is a secure, modular, multi-company Business Operating System for
Eliza Source, 19BAY, 1 & 9, and future companies, brands, branches, and
warehouses.

Development is **document-driven** and **phase-controlled**:

- The implementation authority is the documentation in [`docs/`](docs/README.md).
- The active phase is declared in [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md);
  only that phase may be implemented.
- Each phase completes with evidence and stops; the owner explicitly
  authorizes the next phase.

## Current state

**Phase 01 — Secure Platform Foundation: implemented on staging.**
Auth, multi-company organization structure, permissions, append-only
audit, private storage, and the admin area are live against the staging
Supabase project. Production deployment is prepared and owner-gated — see
[`docs/releases/PHASE_01_PRODUCTION_DEPLOYMENT_PLAN.md`](docs/releases/PHASE_01_PRODUCTION_DEPLOYMENT_PLAN.md)
and the phase report in
[`docs/phases/PHASE_01_SECURE_PLATFORM_FOUNDATION.md`](docs/phases/PHASE_01_SECURE_PLATFORM_FOUNDATION.md).

### Getting started (development — staging Supabase)

```bash
npm install
cp .env.example .env.local   # fill with STAGING values (names only in the example)
npm run dev                  # http://localhost:3000
npm run verify               # lint + typecheck + unit tests + build
```

## Approved stack

Next.js (App Router) + TypeScript · Supabase (PostgreSQL, Auth, Storage) ·
Vercel · Zod · see
[`docs/adr/ADR-0001-technology-stack.md`](docs/adr/ADR-0001-technology-stack.md).
