# Eliza OS — Module Roadmap

Modules are delivered by phase. A module may not be implemented before its
phase is activated by the owner, except where a phase explicitly names it
as foundational infrastructure.

| Phase | Module(s) | Directory (`docs/modules/`) | Status |
|---|---|---|---|
| 00 | Governance & documentation | — | Complete |
| 01 | organization, authentication, permissions, audit, storage | `organization/`, `authentication/`, `permissions/`, `audit/`, `storage/` | Implemented on staging (production gated) |
| 02 | Product master | `products/` | Complete in Staging (production gated) |
| 03 | Supplier management (China, Bangladesh, quotations) | `suppliers/` | Complete in Staging (production gated) |
| 04 | Purchasing and samples | `purchasing/` | Complete in Staging (production gated) |
| 05 | Inventory and warehouse | `inventory/` | Implemented on staging (owner verification pending) |
| 06 | Barcode management | `barcode/` | Not started |
| 07 | POS | `pos/` | Not started |
| 08 | CRM and customer service | `crm/` | Not started |
| 09 | Order fulfilment | `orders/` | Not started |
| 10 | Employee management | `employees/` | Not started |
| 11 | Tasks, projects and SOPs | `tasks/` | Not started |
| 12 | Finance | `finance/` | Not started |
| 13 | Reporting platform | `reporting/` | Not started |
| 14 | Initiatives and results | `initiatives/` | Not started |
| 15 | Meta reporting | `meta/` | Not started |
| 16 | Amazon reporting (ACOS/TACOS) | `amazon/` | Not started |
| 17 | SEO and content reporting | `seo/` | Not started |
| 18 | Executive dashboards / CEO command center | `dashboards/` | Not started |
| 19 | Alerts and automation | `alerts/` | Not started |
| 20 | Advanced integrations | `integrations/` | Not started |
| 21 | Security and continuity hardening | (cross-cutting) | Not started |
| 22 | AI decision support | `ai/` | Not started |

## Module documentation requirement

When a module's phase activates, its directory must gain at minimum:

```
<MODULE>_SPEC.md               Purpose, owner, users, entities, tables,
                               relationships, workflow, permissions,
                               approvals, audit events, validation, file
                               access, import/export, notifications,
                               reports, error handling, tests, completion
                               criteria
<MODULE>_WORKFLOW.md           Status workflows and transitions
<MODULE>_PERMISSION_MATRIX.md  Module permissions per role
<MODULE>_AUDIT_EVENTS.md       Module audit events
<MODULE>_TEST_PLAN.md          Module test plan
```

Ordering changes to this roadmap require an approved ADR.
