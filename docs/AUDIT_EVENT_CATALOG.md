# Eliza OS — Audit Event Catalog

## 1. Purpose

Every sensitive action creates an audit record. This catalog defines the
audit record shape and registers all audit events. Module phases append
their events here when they activate.

## 2. Audit record shape

Fields, where applicable:

| Field | Notes |
|---|---|
| `actor_user_id` | Authenticated user performing the action |
| `actor_employee_id` | Linked employee record where one exists |
| `company_id` / `branch_id` | Scope of the affected record |
| `module` | e.g. `organization`, `auth`, `audit`, `storage` |
| `action` | e.g. `create`, `update`, `suspend`, `download` |
| `entity_type` / `entity_id` | Affected record |
| `previous_value` / `new_value` | Changed fields only; never secrets |
| `reason` | Free-text or coded reason where required |
| `approval_reference` | Linked approval record where applicable |
| `request_id` | Correlates with application logs |
| `ip_metadata` | Where legally and technically appropriate |
| `user_agent` | Request user agent |
| `created_at` | `timestamptz` |
| `result` | `success` / `failure` |
| `failure_reason` | On failure |

**Prohibited content:** passwords, tokens, secrets, or unnecessary
sensitive values. Highly Confidential field values are referenced, not
copied, unless the event's purpose requires the change values (e.g. salary
change → store via approval record, not raw in the general log, per module
spec).

Audit records are append-only. No update or delete path exists in
application code; database privileges prevent modification.

## 3. Event naming convention

`<module>.<entity>.<action>` matching the permission naming convention,
e.g. `auth.user.login_failed`, `organization.company.created`.

## 4. Registered events

### Phase 01 — planned (finalized in the Phase 01 spec)

| Event | Trigger |
|---|---|
| `auth.user.invited` | User invitation issued |
| `auth.user.activated` | Invitation accepted / account activated |
| `auth.user.login_succeeded` | Successful sign-in |
| `auth.user.login_failed` | Failed sign-in attempt |
| `auth.user.suspended` / `auth.user.reinstated` | Account state change |
| `auth.user.role_assigned` / `auth.user.role_revoked` | Role change |
| `auth.user.scope_granted` / `auth.user.scope_revoked` | Company/branch/warehouse/department grant change |
| `organization.company.created` / `.updated` / `.archived` | Company lifecycle |
| `organization.branch.created` / `.updated` / `.archived` | Branch lifecycle |
| `organization.warehouse.created` / `.updated` / `.archived` | Warehouse lifecycle |
| `organization.department.created` / `.updated` / `.archived` | Department lifecycle |
| `storage.file.uploaded` / `.downloaded` / `.deleted` | Private file operations |
| `audit.log.exported` | Audit log export |

### Later phases

Registered in each module's `*_AUDIT_EVENTS.md` and appended here when the
phase activates.

## 5. Status

Catalog structure and Phase 01 planned events defined in Phase 00.
Implementation (table, service, tests) is Phase 01 scope.
