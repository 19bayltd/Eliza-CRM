# Products Module — Permission Matrix

Default role mappings seeded by migration `20260805110002` (owner may
re-map at any time via role administration in later phases; recorded as
D-017).

| Permission | Owner | Administrator | Manager | Employee | Viewer |
|---|---|---|---|---|---|
| `products.view` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `products.create` | ✔ | ✔ | ✔ | — | — |
| `products.update` | ✔ | ✔ | ✔ | — | — |
| `products.archive` | ✔ | ✔ | ✔ | — | — |
| `products.catalog.manage` | ✔ | ✔ | ✔ | — | — |
| `products.intelligence.view` | ✔ | ✔ | — | — | — |
| `products.import` | ✔ | ✔ | — | — | — |
| `products.export` | ✔ | ✔ | — | — | — |

Rules:

- All permission checks are company-scoped: the caller needs the
  permission via a global or matching-company role grant AND explicit
  company scope (Phase 01 evaluator, unchanged).
- Confidential intelligence WRITE requires `products.update` +
  `products.intelligence.view` together.
- Image upload to the confidential tier requires
  `products.intelligence.view` (bucket-level) in addition to
  `products.update` (module-level).
- Applying an import requires `products.import` + `products.create` +
  `products.update`.
- UI rendering is permission-aware, but every rule above is enforced
  server-side and (reads) at the database boundary via RLS.
