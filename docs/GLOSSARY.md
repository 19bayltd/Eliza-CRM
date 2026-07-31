# Eliza OS — Glossary

| Term | Definition |
|---|---|
| **ACOS** | Advertising Cost of Sales (Amazon): ad spend ÷ ad-attributed revenue |
| **TACOS** | Total Advertising Cost of Sales: ad spend ÷ total revenue |
| **ADR** | Architecture Decision Record (`docs/adr/`) |
| **Active phase** | The single phase declared current in `IMPLEMENTATION_STATUS.md`; the only phase that may be implemented |
| **Approval record** | A stored request/decision pair (requester, approver, previous/proposed value, reason, status, dates, note) gating a sensitive action |
| **Audit event** | Append-only record of a sensitive action per `AUDIT_EVENT_CATALOG.md` |
| **Base currency** | The currency financial values are normalized into for reporting (set per company) |
| **Branch** | A physical or organizational subdivision of a company |
| **Company** | A legal/business entity in the system (Eliza Source, 19BAY, 1 & 9, future) |
| **Data classification** | Public / Internal / Confidential / Highly Confidential (`SECURITY_MODEL.md` §1) |
| **Import job** | Tracked CSV/external import with idempotency, counts, and error report |
| **Ledger (stock ledger)** | Immutable sequence of inventory transactions from which balances derive |
| **Module** | A bounded business domain (see `MODULE_ROADMAP.md`) |
| **Owner** | The business owner; final authority for phase activation and approvals |
| **Phase** | A delivery stage (00–22) with its own specification, scope, and completion verdict |
| **POS** | Point of Sale |
| **RLS** | Row-Level Security (PostgreSQL) — database-enforced row scoping |
| **Scope grant** | Explicit row granting a user access to a company/branch/warehouse/department |
| **Service role key** | Supabase key bypassing RLS; server-side only, never in the browser |
| **SKU** | Stock Keeping Unit; unique per company |
| **SOP** | Standard Operating Procedure |
| **Work package** | Independently testable slice of a phase's implementation plan |

Add terms as modules introduce them; keep alphabetical order.
