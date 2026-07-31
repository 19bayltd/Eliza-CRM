# Phase 02 — Product Master

> **Status: Scoped draft.** This phase is not active. The draft records the
> approved scope boundary; the full specification (detailed schema,
> permissions, audit events, validation, tests) is completed and
> owner-reviewed at phase activation, before implementation.

## Objective

Create the product master: products, variants, categories, attributes, internal SKUs, and confidential product intelligence, as the single product source of truth.

## Business Outcome

Every product and variant exists once, with unique per-company SKUs, controlled statuses, and confidential sourcing data visible only to authorized users.

## Included Scope

- Products, variants, categories, attributes, units
- Internal SKU and variant SKU management (unique per company)
- Product status workflow (draft → active → archived, finalized at activation)
- Confidential product intelligence (classification: Confidential)
- Public vs confidential product images (`FILE_STORAGE_POLICY.md`)
- Product CSV import per master import pipeline (§18)

## Excluded Scope

- Supplier linkage beyond placeholder references (Phase 03)
- Pricing/costing engines (Phases 04/12)
- Inventory balances (Phase 05), barcodes (Phase 06)
- Everything belonging to other phases (see `MODULE_ROADMAP.md`)

## Dependencies

Phase 01 complete (organization, auth, permissions, audit, storage).

## Database Changes

Product-domain tables with per-company unique SKU constraints.
All changes follow `DATABASE_ARCHITECTURE.md` (migrations, FKs,
constraints, timestamptz, numeric money, RLS, no destructive ops without
approval). Detailed DDL is designed at activation.

## Permission Requirements

Product view/create/update/archive, confidential-intelligence view, import/export permissions.
Full 12-point server-side check per `ROLE_PERMISSION_MATRIX.md` §1; a
module permission matrix is authored at activation.

## Audit Requirements

Product lifecycle, confidential-data access, import job events.
Events follow `AUDIT_EVENT_CATALOG.md` conventions and are registered
there at activation.

## File-Storage Requirements

Buckets: `public-product-images` (Public), `confidential-product-images` (Confidential).

## Backend Requirements

Server-side services per `ARCHITECTURE.md` §3; centralized permission,
audit, and validation services; transaction boundaries per
`DATABASE_ARCHITECTURE.md` §6. Detailed at activation.

## Frontend Requirements

Interfaces meet `DEVELOPMENT_WORKFLOW.md` §1 step 8 standards (loading/
empty/error states, validation feedback, permission-aware actions,
destructive-action confirmation, accessibility, no fake data). Detailed at
activation.

## Validation Rules

Zod schemas at every boundary; server-side authoritative. Module-specific
rules detailed at activation.

## Approval Rules

Approval-gated actions for this phase are enumerated at activation per
`SECURITY_MODEL.md` §6; approval records follow master approval-record
shape.

## Error Handling

Explicit typed errors; no silent failures; sensitive-action failures
audited with result=failure.

## Security Requirements

Full `SECURITY_MODEL.md` compliance, including data classification of
all new entities, RLS scoping, and export controls.

## Testing Requirements

`TESTING_STRATEGY.md` §2 case list for every protected operation,
cross-company isolation coverage for all new tables, and module-specific
scenarios detailed at activation.

## Migration Plan

Per `DEPLOYMENT_AND_ROLLBACK.md`: dev → staging → production, additive
first, backfills documented and tested.

## Rollback Plan

Compensating migrations documented with each forward migration; app
rollback via previous build. Phase-specific steps detailed at activation.

## Deliverables

Implemented scope, module documentation set (`MODULE_ROADMAP.md`
requirement), updated cross-cutting docs, verification evidence, phase
completion report.

## Completion Criteria

Master completion rule (`docs/README.md` Governing rules; master spec):
all criteria individually marked Pass/Fail with evidence at completion.
Criteria are finalized at activation.

## Open Questions

To be gathered at activation review with the owner.

## Risks

Registered/reviewed in `RISK_REGISTER.md` at activation.

## Implementation Checklist

- [ ] Activation approved by owner in `IMPLEMENTATION_STATUS.md`
- [ ] Full specification completed and owner-reviewed
- [ ] Gap analysis and work-package plan produced
- [ ] Implementation, tests, verification, documentation, completion report

## Verification Evidence

None — phase not started.

## Final Phase Verdict

Not started.
