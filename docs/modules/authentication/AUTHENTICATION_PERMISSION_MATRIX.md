# Authentication Module — Permission Matrix (Phase 01)

| Permission | Owner | Administrator | Manager | Employee | Viewer |
|---|---|---|---|---|---|
| users.view | ✓ | ✓ | ✓ | – | – |
| users.invite | ✓ | ✓ | – | – | – |
| users.update | ✓ | ✓ | – | – | – |
| users.suspend | ✓ | ✓ | – | – | – |

Visibility rule: administrators see users sharing a company where they hold `users.view`, plus unscoped invitees; only global grants (owner) see everyone. Suspension authority requires a shared company with `users.suspend` or a global grant. The owner role is never assignable via invitation.
