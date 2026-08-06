# Suppliers Module — Permission Matrix

Default role mappings seeded by migration `20260806120002` (owner may
re-map; recorded as D-019).

| Permission | Owner | Administrator | Manager | Employee | Viewer |
|---|---|---|---|---|---|
| `suppliers.view` | ✔ | ✔ | ✔ | ✔ | — |
| `suppliers.manage` | ✔ | ✔ | ✔ | — | — |
| `suppliers.quotation.view` (no prices) | ✔ | ✔ | ✔ | — | — |
| `suppliers.quotation.cost.view` | ✔ | ✔ | — | — | — |
| `suppliers.quotation.manage` | ✔ | ✔ | — | — | — |
| `suppliers.document.download` | ✔ | ✔ | — | — | — |
| `suppliers.document.manage` | ✔ | ✔ | — | — | — |

Rules:

- All checks are company-scoped (role grant + explicit company scope).
- Quotation existence and prices are SEPARATE permissions: a manager
  sees terms/MOQ/lead-time with prices rendered as `•••`.
- Creating/editing a quotation requires `quotation.manage` AND
  `cost.view` (a quotation includes its price).
- Quotation managers cannot be granted price-free creation — by design.
- Document downloads are audited per file; uploads capped 25 MB,
  pdf/image/office types only.
