# Suppliers Module — Audit Events

All events: module `suppliers`, actor + company recorded, append-only.
Confidential price values NEVER enter payloads — quotation events record
supplier/product/currency/terms metadata only.

| Action | Trigger | Payload notes |
|---|---|---|
| `supplier.created` | supplier create | code, name, country |
| `supplier.updated` | supplier edit | before/after of name, country, address, capabilities |
| `supplier.archived` | supplier archive | reason; refused while active quotations exist |
| `supplier.contact_added` / `supplier.contact_archived` | contact lifecycle | supplier code + contact name; archive carries reason |
| `quotation.created` | quotation create | supplier, product sku, currency, MOQ, lead time, validity — NO price |
| `quotation.archived` | quotation archive | reason |
| `quotation.cost_viewed` | any page render exposing prices (non-critical write) | entity = supplier or product; count of priced quotations — NO values |
| `supplier.document_uploaded` / `supplier.document_removed` | document registry | supplier code + title |

Storage-layer events (`storage` module): `file.uploaded`,
`file.downloaded`, `file.deleted` fire for every supplier-document
object — including each individual download of a confidential document.
