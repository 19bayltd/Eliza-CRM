# Organization Module — Audit Events (Phase 01, implemented)

| Event (module.action) | Trigger | Values captured |
|---|---|---|
| organization.company.created | createCompany | code, name, currency, timezone |
| organization.company.updated | updateCompany | previous/new name, currency, timezone |
| organization.company.archived | archiveOrgEntity | previous/new status + reason |
| organization.branch.created / .archived | branch ops | code, name / status + reason |
| organization.warehouse.created / .archived | warehouse ops | code, name / status + reason |
| organization.department.created / .archived | department ops | code, name / status + reason |

Audit writes are critical: a failed audit write aborts the operation.
