# Eliza OS Documentation

Eliza OS is a secure, modular, multi-company Business Operating System serving
Eliza Source, 19BAY, 1 & 9, and future companies, brands, branches, and
warehouses.

This directory is the **implementation authority** for the entire system.
All development is document-driven: no code may be written that contradicts
these documents, and any conflict between documents must be recorded and
escalated — never silently resolved.

## How to use this documentation

1. Start with [`ELIZA_OS_MASTER_SPEC.md`](ELIZA_OS_MASTER_SPEC.md) for the
   system purpose and scope.
2. Check [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) for the
   **active phase**. Only the active phase may be implemented.
3. Read the active phase specification in [`phases/`](phases/).
4. Read the module specifications in [`modules/`](modules/) relevant to the
   active phase.
5. Consult the cross-cutting documents before writing any code:
   - [`ARCHITECTURE.md`](ARCHITECTURE.md)
   - [`DATABASE_ARCHITECTURE.md`](DATABASE_ARCHITECTURE.md)
   - [`ROLE_PERMISSION_MATRIX.md`](ROLE_PERMISSION_MATRIX.md)
   - [`SECURITY_MODEL.md`](SECURITY_MODEL.md)
   - [`AUDIT_EVENT_CATALOG.md`](AUDIT_EVENT_CATALOG.md)
   - [`FILE_STORAGE_POLICY.md`](FILE_STORAGE_POLICY.md)
   - [`DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md)
   - [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md)
   - [`DEPLOYMENT_AND_ROLLBACK.md`](DEPLOYMENT_AND_ROLLBACK.md)

## Directory map

| Path | Purpose |
|---|---|
| `phases/` | One specification per implementation phase (00–22) |
| `modules/` | Per-module specifications (created when a module's phase activates) |
| `adr/` | Architecture Decision Records |
| `audits/` | Code, security, database, and release audit logs |
| `releases/` | Release checklist and changelog |
| `DECISION_LOG.md` | Running log of significant decisions |
| `RISK_REGISTER.md` | Live risk register |
| `GLOSSARY.md` | Shared vocabulary |

## Governing rules

- **Phase control** — only the phase declared active in
  `IMPLEMENTATION_STATUS.md` may be implemented. Completing a phase does not
  authorize the next one; the owner must explicitly approve each activation.
- **Conflicts** — if two documents conflict: do not guess; record the
  conflict in `DECISION_LOG.md`; stop implementation of the conflicting
  section; request an architecture decision.
- **Completion** — a phase is complete only when every completion criterion
  is individually marked pass or fail with evidence. "Mostly complete" is
  not a verdict.
- **Security** — the rules in `SECURITY_MODEL.md` apply to every phase from
  the first line of code. Security is not a final-phase feature.
