# Storage Module — Audit Events (Phase 01, implemented)

| Event | Trigger | Values |
|---|---|---|
| storage.file.uploaded | uploadPrivateFile | bucket, name, mime, size |
| storage.file.downloaded | createSignedDownloadUrl | bucket, name |
| storage.file.deleted | deletePrivateFile | bucket, name |

All writes are critical (failure aborts the operation).
