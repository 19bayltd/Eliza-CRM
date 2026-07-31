# Eliza OS — Master Specification

## 1. Purpose

Eliza OS is the central operating system for:

- Eliza Source
- 19BAY
- 1 & 9
- Future companies, brands, branches, and warehouses

It must become the **one reliable source of truth** for the organization.
Every major business process should eventually answer:

1. What happened?
2. Why did it happen?
3. Who was responsible?
4. What action was taken?
5. What result did the action produce?

## 2. Eventual functional scope

The system will eventually manage: companies, branches, warehouses,
departments, employees, CRM, customer service, orders, product master,
confidential product intelligence, China suppliers, Bangladesh suppliers,
supplier quotations, samples, purchasing, inventory, warehouse operations,
barcode management, POS, employee records, private employee documents,
micro-task management, projects, SOPs, approvals, finance, Meta reporting,
Amazon reporting (including ACOS and TACOS), SEO reporting, website
reporting, initiative tracking, result tracking, department dashboards, a
CEO command center, alerts, notifications, automation, audit logs, external
integrations, and AI-assisted decision support.

Scope is delivered strictly phase by phase per `MODULE_ROADMAP.md` and the
specifications in `phases/`. Future modules are never implemented early
unless they are foundational infrastructure explicitly required by the
active phase.

## 3. Approved technology stack

Repository documentation may replace items only via an approved ADR.

### Application
- Next.js (App Router), TypeScript, React
- Server Components where appropriate; Client Components only where
  interaction requires them

### Database and backend
- Supabase: PostgreSQL, Supabase Auth, Supabase Storage
- Version-controlled SQL migrations
- Server-side database access for all privileged operations

### Hosting and infrastructure
- GitHub private repository
- Vercel development, preview/staging, and production environments
- Supabase development, staging (where required), and production projects

### Validation and forms
- Zod; React Hook Form where appropriate

### Testing
- Unit, integration, and end-to-end tests
- Database migration checks
- Permission and authorization tests

### Code quality
- ESLint, TypeScript strict mode, formatting, CI build validation,
  dependency checks

See `adr/ADR-0001-technology-stack.md`.

## 4. Non-negotiable system principles

1. **Document-driven development** — the documents in `docs/` are the
   implementation authority (see `docs/README.md`).
2. **Phase discipline** — only the active phase in
   `IMPLEMENTATION_STATUS.md` is implemented; the owner authorizes each
   next phase explicitly.
3. **Multi-company from day one** — data is separated by company, branch,
   warehouse, department, and user scope. Never assume every user can see
   every company. Cross-company access is explicit and auditable.
4. **Server-side enforcement** — permission checks, sensitive data access,
   and financial/inventory mutations execute server-side. Hidden buttons
   are not security.
5. **Immutable business history** — important records are never deleted;
   use controlled cancellation, archival, reversal, amendment, or status
   transitions. Inventory uses an immutable stock ledger.
6. **Atomic transactions** — operations affecting multiple financial or
   inventory records are all-or-nothing (see `DATABASE_ARCHITECTURE.md`).
7. **Auditability** — every sensitive action creates an audit record per
   `AUDIT_EVENT_CATALOG.md`.
8. **Data classification** — Public / Internal / Confidential / Highly
   Confidential, enforced across permissions, storage, exports, and
   auditing (see `SECURITY_MODEL.md`).
9. **Configurable approvals** — sensitive actions can require approval;
   approved records are never silently modified afterward.
10. **Traceable reporting** — no invented metrics, no hard-coded dashboard
    values; imported data traceable to its import job and source.
11. **AI last** — AI features arrive only after reliable data and
    workflows exist, must cite sources, and never independently execute
    sensitive actions.

## 5. Phase roadmap (summary)

| Phase | Name |
|---|---|
| 00 | Discovery and Governance |
| 01 | Secure Platform Foundation |
| 02 | Product Master |
| 03 | Supplier Management |
| 04 | Purchasing and Samples |
| 05 | Inventory and Warehouse |
| 06 | Barcode Management |
| 07 | POS |
| 08 | CRM and Customer Service |
| 09 | Order Fulfilment |
| 10 | Employee Management |
| 11 | Tasks, Projects and SOPs |
| 12 | Finance |
| 13 | Reporting Platform |
| 14 | Initiatives and Results |
| 15 | Meta Reporting |
| 16 | Amazon Reporting |
| 17 | SEO and Content Reporting |
| 18 | Executive Dashboards |
| 19 | Alerts and Automation |
| 20 | Advanced Integrations |
| 21 | Security and Continuity |
| 22 | AI Decision Support |

Detailed scope per phase lives in `phases/PHASE_XX_*.md`. Ordering may only
change via an approved ADR.

## 6. Ownership

- **System owner:** the business owner (final authority on phase
  activation, scope, and approvals).
- **Implementation:** principal implementation engineer, operating under
  the rules in this documentation set.
