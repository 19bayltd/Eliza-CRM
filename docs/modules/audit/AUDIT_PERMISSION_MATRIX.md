# Audit Module — Permission Matrix (Phase 01)

| Permission | Owner | Administrator | Manager | Employee | Viewer |
|---|---|---|---|---|---|
| audit.log.view | ✓ | ✓ | – | – | – |

Scoped per company; global grants additionally see events with no company
binding (e.g. invitations). Direct table access is denied to all clients.
