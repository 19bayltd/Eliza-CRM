# Architecture Decision Records

ADRs record major architectural decisions for Eliza OS. No major
irreversible architectural decision is made without one, and each requires
owner approval before its status becomes **Approved**.

## Index

| ADR | Title | Status | Date |
|---|---|---|---|
| [ADR-0001](ADR-0001-technology-stack.md) | Technology stack | Approved | 2026-07-31 |
| [ADR-0002](ADR-0002-test-tooling.md) | Test tooling: Vitest and Playwright | Approved | 2026-07-31 |

## Process

1. Copy the template below into `ADR-XXXX-title.md` (next sequential
   number, kebab-case title).
2. Status starts as **Proposed**.
3. Owner review → **Approved** or **Rejected**. Superseding ADRs mark the
   old one **Superseded** with a link.
4. Add the ADR to the index above and reference it from
   `docs/DECISION_LOG.md`.

## Template

```markdown
# ADR-XXXX — Decision Title

## Status
Proposed / Approved / Rejected / Superseded

## Context

## Decision

## Alternatives Considered

## Consequences

## Security Impact

## Migration Impact

## Rollback Considerations

## Date

## Approved By
```
