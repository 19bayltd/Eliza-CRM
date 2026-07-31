# ADR-0001 — Technology Stack

## Status

Approved

## Context

Eliza OS requires a stack supporting: a multi-company web application with
strong server-side enforcement, relational integrity with RLS, private
file storage, staged environments, and strict typing. The owner supplied an
approved stack in the Eliza OS master implementation directive; this ADR
formalizes it as the repository's architectural authority.

## Decision

- **Application:** Next.js (App Router), TypeScript (strict), React.
  Server Components by default; Client Components only where interaction
  requires them.
- **Backend/database:** Supabase — PostgreSQL (with RLS), Supabase Auth,
  Supabase Storage; version-controlled SQL migrations; server-side
  database access for privileged operations.
- **Hosting:** private GitHub repository; Vercel (development,
  preview/staging, production); Supabase projects per environment.
- **Validation/forms:** Zod; React Hook Form where appropriate.
- **Quality:** ESLint, strict TypeScript, formatting, CI build validation,
  dependency checks.
- **Testing:** unit, integration, e2e, migration checks,
  permission/authorization tests (tooling proposal: Vitest + Playwright —
  decision D-006, ratified or replaced by ADR at Phase 01 start).

## Alternatives Considered

- Separate custom backend (NestJS/Express + managed Postgres): more
  control, but duplicates what Supabase provides (Auth, Storage, RLS) and
  increases operational surface for a small team.
- Firebase: weaker relational integrity and RLS-style scoping for a
  multi-company relational domain.
- Remix/SvelteKit: viable, but the owner-approved stack specifies Next.js
  and no technical driver justifies deviation.

## Consequences

- One modular monolith; module boundaries enforced by convention, schema,
  and permissions rather than service boundaries.
- RLS becomes a mandatory second enforcement layer on all scoped tables.
- Vendor coupling to Supabase/Vercel accepted; mitigated by plain SQL
  migrations and standard Postgres.

## Security Impact

Positive: Supabase Auth + RLS + private storage with signed URLs align
with `SECURITY_MODEL.md`. Service-role key handling is the key risk —
server-only usage is mandatory.

## Migration Impact

None yet (no code). All future schema work uses `supabase/migrations/`.

## Rollback Considerations

Reversing this decision before Phase 01 costs nothing. After Phase 01 it
requires a superseding ADR and a funded migration plan.

## Date

2026-07-31

## Approved By

Business owner (stack supplied as approved in the Eliza OS master
implementation directive).
