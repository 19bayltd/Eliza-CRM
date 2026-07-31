# Eliza OS — Database Architecture

## 1. Platform

PostgreSQL on Supabase. All schema changes are made through
version-controlled SQL migrations in `supabase/migrations/`. Manual,
undocumented production changes are prohibited.

## 2. Standard table shape

Every major business table includes, where appropriate:

| Column | Notes |
|---|---|
| `id` | Primary key (uuid) |
| `company_id` | FK → companies; required on company-scoped data |
| `branch_id` | FK → branches; where branch-scoped |
| `status` | Controlled status values; transitions validated |
| `created_at` / `updated_at` | `timestamptz`, defaulted / trigger-maintained |
| `created_by` / `updated_by` | FK → users |
| version / revision | Where amendment history is required |

## 3. Integrity rules

- Foreign keys on every relationship.
- Database constraints for business invariants wherever expressible.
- Unique constraints for: internal SKUs, variant SKUs, barcodes, order
  numbers, purchase-order numbers, invoice numbers, employee IDs, import
  idempotency keys, and external-source IDs where appropriate.
  Uniqueness is scoped per company unless an ADR approves global scope.
- Money: `numeric`/`decimal` only — never floating point. Store amount,
  currency, exchange rate where applicable, and base-currency value where
  required.
- Timestamps: `timestamptz` (explicit timezone-aware) everywhere.

## 4. History and deletion

Important business history is never deleted. Use controlled cancellation,
archival, reversal, amendment, or status transitions. Hard deletes are
allowed only for non-business data (e.g. drafts explicitly designated
disposable) and require documented approval otherwise.

## 5. Inventory ledger

Inventory uses an **immutable stock ledger**. Balances are derived from (or
maintained strictly by) authorized ledger transactions — never directly
overwritten by users. Every stock-changing event creates a ledger
transaction: opening stock, purchase receipt, sale, reservation,
reservation release, customer return, supplier return, damage, adjustment,
transfer out, transfer in, stock-count correction. Negative stock is
blocked unless an explicitly approved rule allows it.

## 6. Transactions

Operations affecting multiple financial or inventory records are atomic —
one database transaction, full rollback on any failure, never partial
business records. Canonical examples:

- **POS completion:** invoice + invoice items + payment + inventory ledger
  entries + customer history + audit events.
- **Purchase receiving:** receiving record + accepted/damaged/missing/extra
  quantities + inventory transactions + purchase status update + audit.
- **Order confirmation:** stock validation + reservation + order status +
  fulfilment work + audit.

## 7. Row-Level Security

RLS is enabled on all company-scoped tables. Policies enforce company (and
narrower) scope from the authenticated user's granted scopes — never from
client-supplied identifiers. The service-role key bypasses RLS and is used
only inside trusted server code that performs its own permission checks.

## 8. Migration rules

Every migration must:
- have a clear, dated, descriptive filename;
- state its purpose in a header comment;
- be deterministic;
- avoid destructive operations unless explicitly approved;
- include backfill logic where necessary;
- include indexes and constraints;
- document rollback considerations;
- be tested against a clean database and against realistic existing data
  where applicable.

## 9. Schema documentation

Each module documents its tables and relationships in its module spec under
`docs/modules/<module>/`. This file records only system-wide rules and the
shared/core schema. It is updated whenever migrations change shared
structures.

## 10. Current schema state (Phase 01)

Seven migrations in `supabase/migrations/`, applied to staging
(`eliza-source-crm-staging`); production apply is gated on the Phase 01
production deployment plan:

| Migration | Contents |
|---|---|
| 20260731100001_core_organization | companies, branches, warehouses, departments; `app` schema + updated_at trigger; client write privileges revoked |
| 20260731100002_identity_access | account_status enum, user_profiles (+auth trigger), roles, permissions, role_permissions, user_roles (global grants via null company), 4 scope tables |
| 20260731100003_audit_log | append-only audit_log (UPDATE/DELETE blocked by trigger for every role); client access fully revoked |
| 20260731100004_storage_foundation | private `system-exports` bucket + file_metadata |
| 20260731100005_rls_policies | `app.is_active_user` / `has_company_access` / `has_permission` (SECURITY DEFINER, STABLE); RLS enabled on all 15 tables; scoped SELECT policies; audit_log deny-all |
| 20260731100006_reference_data | 16-permission catalog, 5 role templates, role-permission mappings (idempotent) |
| 20260731100007_app_schema_grants | `usage on schema app` to authenticated (found by staging RLS verification) |

Seed: `supabase/seed/staging_seed.sql` — the three approved companies
(idempotent by code; no hard-coded UUIDs).
