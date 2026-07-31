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

**Phase 00 — Discovery and Governance: Complete.** The full governance
documentation set exists; no application code has been written yet.
Phase 01 (Secure Platform Foundation) is specified and awaiting owner
activation — see
[`docs/phases/PHASE_01_SECURE_PLATFORM_FOUNDATION.md`](docs/phases/PHASE_01_SECURE_PLATFORM_FOUNDATION.md).

## Approved stack

Next.js (App Router) + TypeScript · Supabase (PostgreSQL, Auth, Storage) ·
Vercel · Zod · see
[`docs/adr/ADR-0001-technology-stack.md`](docs/adr/ADR-0001-technology-stack.md).
