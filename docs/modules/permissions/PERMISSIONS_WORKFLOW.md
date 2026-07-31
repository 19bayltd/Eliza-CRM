# Permissions Module — Workflow

- Assign role: permission `users.role.assign` in the target company (global assignment requires a global grant; owner role only via global authority; never via invitation).
- Revoke role: same authority; self-revocation of owner is forbidden.
- Grant/revoke company scope: `users.scope.assign` in that company; self-revocation forbidden.
- Catalog changes (new permissions) arrive only through reference-data migrations in the phase that introduces them; the Owner mapping is refreshed in the same migration.
