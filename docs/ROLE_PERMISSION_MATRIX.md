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

Unauthorized operations are rejected at the server or database boundary.

## 2. Scope grants

A user may hold access to one or many companies, branches, warehouses, and
departments. Grants are explicit rows, never assumptions. Cross-company
access is explicit and auditable.

## 3. Baseline roles (Phase 01 seed)

| Role | Description |
|---|---|
| `owner` | Business owner. Full access across all companies; sole authority for phase activation and role administration. |
| `admin` | Company-scoped administration: users, roles within granted companies. |
| `manager` | Department/branch-scoped operational management (permissions per module as phases activate). |
| `staff` | Standard operational access per granted module permissions. |
| `viewer` | Read-only access to granted scopes. |

Roles beyond these are added per phase via this document and the module
permission matrices (`docs/modules/<module>/*_PERMISSION_MATRIX.md`).

## 4. Permission naming convention

`<module>.<entity>.<action>` — e.g. `organization.company.create`,
`audit.log.view`, `employees.document.download`.

Actions vocabulary: `view`, `list`, `create`, `update`, `archive`,
`approve`, `export`, `download`, `import`, `adjust`, plus module-specific
verbs defined in module matrices.

## 5. Phase 01 permission set (to be finalized in the Phase 01 spec)

| Permission | owner | admin | manager | staff | viewer |
|---|---|---|---|---|---|
| organization.company.view | ✓ | ✓ | ✓ | ✓ | ✓ |
| organization.company.create | ✓ | – | – | – | – |
| organization.company.update | ✓ | – | – | – | – |
| organization.branch.manage | ✓ | ✓ | – | – | – |
| organization.warehouse.manage | ✓ | ✓ | – | – | – |
| organization.department.manage | ✓ | ✓ | – | – | – |
| users.invite | ✓ | ✓ | – | – | – |
| users.suspend | ✓ | ✓ | – | – | – |
| users.role.assign | ✓ | ✓ | – | – | – |
| audit.log.view | ✓ | ✓ | – | – | – |

All grants above are additionally constrained by company scope (admin acts
only within granted companies).

## 6. Rules

- Never trust client-supplied permissions or scope identifiers.
- Never scatter permission logic through components — use the central
  `server/permissions` service.
- Developers do not receive production employee-document access by
  default; production access is limited, justified, time-bound where
  possible, and audited.
- Changes to this matrix require owner approval and a decision-log entry.

## 7. Status

Baseline model defined in Phase 00. Concrete enforcement (tables, RLS,
services, tests) is Phase 01 scope. Module-specific permissions are added
when their phase activates.
