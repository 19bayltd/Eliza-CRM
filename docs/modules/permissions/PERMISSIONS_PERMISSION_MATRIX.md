# Permissions Module — Permission Matrix (Phase 01)

| Permission | Owner | Administrator | Manager | Employee | Viewer |
|---|---|---|---|---|---|
| users.role.assign | ✓ | ✓ | – | – | – |
| users.scope.assign | ✓ | ✓ | – | – | – |

Constraints enforced in services: owner role assignable only with global authority; global grants require global authority; administrators act only within their granted companies.
