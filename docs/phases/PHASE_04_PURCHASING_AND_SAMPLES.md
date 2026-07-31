# Phase 04 — Purchasing and Samples

> **Status: Scoped draft.** This phase is not active. The draft records the
> approved scope boundary; the full specification (detailed schema,
> permissions, audit events, validation, tests) is completed and
> owner-reviewed at phase activation, before implementation.

## Objective

Implement purchase requests, purchase orders, sample requests/evaluations, and purchase receiving.

## Business Outcome

Purchasing runs through controlled, approvable workflows; receiving atomically records accepted/damaged/missing/extra quantities.

## Included Scope

- Purchase requests with approval workflow
- Purchase orders (unique per-company PO numbers)
- Sample requests, tracking, and evaluation
- Purchase receiving (atomic per `DATABASE_ARCHITECTURE.md` §6)
- Configurable approval engine (first consumer)

## Excluded Scope

- Inventory ledger effects beyond receiving hooks (Phase 05 owns ledger)
- Supplier invoicing/payments (Phase 12)
- Everything belonging to other phases (see `MODULE_ROADMAP.md`)

## Dependencies

Phases 01–03 complete. Receiving's inventory postings coordinate with Phase 05 design; if Phase 05 is not yet active, receiving records quantities without ledger postings and the dependency is flagged at activation.

## Database Changes

PR/PO/sample/receiving tables; PO number uniqueness; money as numeric with currency and exchange rate.
All changes follow `DATABASE_ARCHITECTURE.md` (migrations, FKs,
constraints, timestamptz, numeric money, RLS, no destructive ops without
approval). Detailed DDL is designed at activation.

## Permission Requirements

Request/approve/order/receive permissions; approval thresholds configurable, never hard-coded.
Full 12-point server-side check per `ROLE_PERMISSION_MATRIX.md` §1; a
module permission matrix is authored at activation.

## Audit Requirements

PR/PO lifecycle, approvals, receiving events.
Events follow `AUDIT_EVENT_CATALOG.md` conventions and are registered
there at activation.

## File-Storage Requirements

PO documents and sample photos per `FILE_STORAGE_POLICY.md`.

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
