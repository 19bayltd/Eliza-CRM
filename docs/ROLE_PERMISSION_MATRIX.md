# Eliza OS — Role and Permission Matrix

## 1. Model

Authorization is **permission-based**, not hard-coded role-name checks.
Roles are bundles of permissions; code checks permissions. Every protected
operation verifies, server-side:

1. Authenticated user
2. Account status (active — not invited/suspended/locked/disabled/exited)
3. Assigned role(s)
4. Specific permission
5. Company scope
6. Branch scope (where applicable)
7. Warehouse scope (where applicable)
8. Department scope (where applicable)
9. Own-record / assigned-record scope (where applicable)
10. Approval requirement
11. Record status
12. Data classification

Unauthorized operations are rejected at the server boundary
(`server/permissions`) and mirrored at the database boundary (RLS via
`app.is_active_user()`, `app.has_company_access()`, `app.has_permission()`).

## 2. Scope grants

A user may hold access to one or many companies, branches, warehouses, and
departments — explicit rows in `user_company_scopes`, `user_branch_scopes`,
`user_warehouse_scopes`, `user_department_scopes`. Cross-company access is
explicit and auditable. Role assignments (`user_roles`) bind to a company,
or globally (`company_id null`); global grants widen role applicability but
never bypass explicit company scopes, and granting them requires global
authority (D-011).

## 3. Role templates (implemented — migration 20260731100006)

| Role (key) | Description |
|---|---|
| Owner (`owner`) | Full access; sole authority for company lifecycle and phase gates. Never assignable via invitation; global assignment only. |
| Administrator (`administrator`) | Organization structure and user administration within granted companies. |
| Manager (`manager`) | Operational management within granted scopes; module permissions arrive per phase. |
| Employee (`employee`) | Standard operational access per granted module permissions. |
| Viewer (`viewer`) | Read-only access within granted scopes. |

## 4. Permission naming convention

`<module>.<entity>.<action>` — e.g. `organization.company.create`,
`audit.log.view`. Catalog changes only via reference-data migrations.

## 5. Phase 01 permission matrix (implemented)

| Permission | Owner | Administrator | Manager | Employee | Viewer |
|---|---|---|---|---|---|
| organization.company.view | ✓ | ✓ | ✓ | ✓ | ✓ |
| organization.company.create ¹ | ✓ | – | – | – | – |
| organization.company.update | ✓ | – | – | – | – |
| organization.company.archive | ✓ | – | – | – | – |
| organization.branch.manage | ✓ | ✓ | – | – | – |
| organization.warehouse.manage | ✓ | ✓ | – | – | – |
| organization.department.manage | ✓ | ✓ | – | – | – |
| users.view | ✓ | ✓ | ✓ | – | – |
| users.invite | ✓ | ✓ | – | – | – |
| users.update | ✓ | ✓ | – | – | – |
| users.suspend | ✓ | ✓ | – | – | – |
| users.role.assign ² | ✓ | ✓ | – | – | – |
| users.scope.assign | ✓ | ✓ | – | – | – |
| audit.log.view | ✓ | ✓ | – | – | – |
| storage.file.upload | ✓ | ✓ | – | – | – |
| storage.file.download | ✓ | ✓ | ✓ | – | – |

¹ Requires a **global** role grant (companies are inherently cross-company).
² Owner-role and global assignments require global authority.

All grants are additionally constrained by company scope. Module-specific
matrices live in `docs/modules/<module>/*_PERMISSION_MATRIX.md`.

## 6. Rules

- Never trust client-supplied permissions or scope identifiers.
- Never scatter permission logic — use `server/permissions`
  (`requirePermission`/`requireGlobalPermission`/`hasPermission`) backed by
  the pure evaluator in `server/permissions/evaluate.ts`.
- Developers do not receive production employee-document access by
  default; production access is limited, justified, time-bound where
  possible, and audited.
- Changes to this matrix require owner approval and a decision-log entry.

## 7. Status

Implemented in Phase 01: tables, RLS, seeded templates, central service,
admin UI, and tests (unit matrix tests + staging RLS verification).
Module-specific permissions are added when their phase activates.
