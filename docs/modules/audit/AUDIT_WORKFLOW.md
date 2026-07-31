# Audit Module — Workflow

Write path: service performs permission check → mutation → `writeAudit`
(critical) in the same request; failure of a critical audit write aborts
the operation and surfaces an error. Read path: admin UI → `listAuditEvents`
→ per-company `audit.log.view` filter. No update or delete path exists.
Export of audit data is a Phase 13+ concern and will itself be audited.
