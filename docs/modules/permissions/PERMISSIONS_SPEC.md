# Permissions Module — Specification (Phase 01)

## Purpose
Central authorization: roles as permission bundles, explicit organizational scope grants, and a single evaluation path used by every privileged operation.

## Entities and tables
`roles`, `permissions`, `role_permissions`, `user_roles` (company-scoped or global via `company_id null`), `user_company_scopes`, `user_branch_scopes`, `user_warehouse_scopes`, `user_department_scopes` (migration 20260731100002; reference data 20260731100006).

## Design
- Code checks **permissions**, never role names (`server/permissions/index.ts` + pure evaluator `evaluate.ts`).
- The 12-point check: authenticated user → account status → roles → specific permission → company scope → branch/warehouse/department scope (when the user holds narrow grants) → own-record rules (service-level) → approval/status/classification (service-level as modules add them).
- Database boundary mirrors the core checks: `app.is_active_user()`, `app.has_company_access()`, `app.has_permission()` drive RLS.
- Global grants (`user_roles.company_id is null`) still require explicit company scopes for data access; they only widen role applicability. Granting global roles requires global authority.

## Role templates (seeded)
Owner, Administrator, Manager, Employee, Viewer — see `docs/ROLE_PERMISSION_MATRIX.md` for the full matrix.

## Audit events
Role/scope changes audit under `auth.user.*` (see authentication module).

## Error handling
Denials throw `forbidden` with a machine-readable reason; sensitive-action denials audited by calling services.

## Tests
`PERMISSIONS_TEST_PLAN.md`.

## Completion criteria
Single evaluation path, RLS parity, seeded templates, passing matrix tests. Status: implemented in Phase 01.
