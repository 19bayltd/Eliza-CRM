# Products Module — Audit Events

All events: module `products`, actor + company recorded, append-only.
Confidential values are NEVER copied into the log — for intelligence
changes only the list of set field names is recorded.

| Action | Trigger | Payload notes |
|---|---|---|
| `unit.created` / `unit.archived` | catalog writes | code, name; archive carries reason |
| `category.created` / `category.archived` | catalog writes | code, name, parent |
| `attribute.created` / `attribute.value_added` / `attribute.archived` | catalog writes | code / value |
| `product.created` | product create | sku, name, status |
| `product.updated` | product edit | before/after of name, description, category, unit |
| `product.status_changed` | draft→active, archived→active | before/after status + reason |
| `product.archived` | active→archived | before/after status + reason; variants archived with it |
| `variant.created` | variant create | product sku, variant sku, attribute values |
| `variant.status_changed` / `variant.archived` | variant status | before/after + reason |
| `product.intelligence_viewed` | confidential read (non-critical write) | sku + whether a record exists — no values |
| `product.intelligence_updated` | confidential write | field-name lists only — no values |
| `product.image_uploaded` / `product.image_removed` | image registry | sku, tier, file id |
| `import.validated` | CSV validation | filename + row counts |
| `import.applied` | plan execution | applied/failed/rejected counts |
| `import.discarded` | plan discarded | filename, row total |

Storage-layer events (`storage` module, Phase 01): `file.uploaded`,
`file.downloaded`, `file.deleted` fire for every product-image object,
including each confidential-image download.
