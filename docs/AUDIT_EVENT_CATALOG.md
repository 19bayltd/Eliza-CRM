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

### Phase 01 — IMPLEMENTED (services in server/audit, server/services)

| Event | Trigger |
|---|---|
| `auth.user.invited` | User invitation issued |
| `auth.user.activated` | Invitation accepted (invited → active) |
| `auth.user.login_succeeded` | Successful sign-in (non-critical write) |
| `auth.user.login_failed` | Failed sign-in attempt (non-critical) |
| `auth.user.login_blocked` | Sign-in attempt on a non-active account |
| `auth.user.signed_out` | Sign-out (non-critical) |
| `auth.user.password_reset_requested` | Reset requested; `result` reflects the Auth API handoff (accepted/rejected) and `new_value.delivery_confirmed` is always `false` — this event NEVER proves email delivery |
| `auth.user.password_changed` | Password updated |
| `auth.user.status_changed` | Any account-state transition (previous/new + reason) |
| `auth.user.role_assigned` / `auth.user.role_revoked` | Role change |
| `auth.user.scope_granted` / `auth.user.scope_revoked` | Company scope grant change |
| `auth.user.bootstrap_owner` | One-time owner bootstrap |
| `organization.company.created` / `.updated` / `.archived` | Company lifecycle |
| `organization.branch.created` / `.archived` | Branch lifecycle |
| `organization.warehouse.created` / `.archived` | Warehouse lifecycle |
| `organization.department.created` / `.archived` | Department lifecycle |
| `storage.file.uploaded` / `.downloaded` / `.deleted` | Private file operations |
| `audit.append_only_selftest` | Verification runs |

Registered for later phases: `audit.log.exported` (arrives with export
functionality). Update events for org children arrive with edit UIs.

### Phase 02 — IMPLEMENTED (products module, 2026-08-05)

| Event | Trigger |
|---|---|
| `products.unit.created` / `.archived` | Unit lifecycle |
| `products.category.created` / `.archived` | Category lifecycle |
| `products.attribute.created` / `.value_added` / `.archived` | Attribute lifecycle |
| `products.product.created` / `.updated` | Product create/edit |
| `products.product.status_changed` / `.archived` | Status machine (reason required) |
| `products.variant.created` / `.status_changed` / `.archived` | Variant lifecycle |
| `products.product.intelligence_viewed` | Confidential read (non-critical; NO values in payload) |
| `products.product.intelligence_updated` | Confidential write (field-name lists only, never values) |
| `products.product.image_uploaded` / `.image_removed` | Image registry (object ops additionally emit `storage.file.*`) |
| `products.import.validated` / `.applied` / `.discarded` | CSV import pipeline |

Full trigger/payload notes: `modules/products/PRODUCTS_AUDIT_EVENTS.md`.

### Later phases

Registered in each module's `*_AUDIT_EVENTS.md` and appended here when the
phase activates.

## 5. Status

Implemented in Phase 01: append-only `audit_log` table (UPDATE/DELETE
blocked for every role — verified on staging), central `server/audit`
service with sanitization and critical-write semantics, admin viewer gated
by `audit.log.view`, and tests.
