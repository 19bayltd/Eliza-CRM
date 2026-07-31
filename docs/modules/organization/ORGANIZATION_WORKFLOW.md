# Organization Module — Workflow

## Entity lifecycle
```
create (permission-gated, audited)
  → active
  → archived (permission-gated, reason required, audited; terminal in Phase 01)
```
- No deletes, ever. Archival is the only exit.
- Edits allowed only while `active`.
- Company archival does not cascade; children remain but the company is read-only. Unarchival is a future controlled amendment (not in Phase 01).
