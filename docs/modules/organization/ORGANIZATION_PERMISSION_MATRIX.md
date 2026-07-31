# Organization Module — Permission Matrix (Phase 01)

| Permission | Owner | Administrator | Manager | Employee | Viewer |
|---|---|---|---|---|---|
| organization.company.view | ✓ | ✓ | ✓ | ✓ | ✓ |
| organization.company.create (global grant required) | ✓ | – | – | – | – |
| organization.company.update | ✓ | – | – | – | – |
| organization.company.archive | ✓ | – | – | – | – |
| organization.branch.manage | ✓ | ✓ | – | – | – |
| organization.warehouse.manage | ✓ | ✓ | – | – | – |
| organization.department.manage | ✓ | ✓ | – | – | – |

All checks also require: active account + company scope. Enforced in `server/permissions` and by RLS (read side).
