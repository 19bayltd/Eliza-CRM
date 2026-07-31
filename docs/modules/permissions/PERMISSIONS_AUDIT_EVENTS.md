# Permissions Module — Audit Events

Role and scope changes are audited as `auth.user.role_assigned`,
`auth.user.role_revoked`, `auth.user.scope_granted`, `auth.user.scope_revoked`
(see `../authentication/AUTHENTICATION_AUDIT_EVENTS.md`) with previous/new
values and company bindings.
