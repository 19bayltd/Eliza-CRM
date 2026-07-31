# Authentication Module — Test Plan (Phase 01)

## Unit (implemented)
- Sign-in/reset/set-password validation incl. 12-char minimum and match.
- Status-change validation: reason required, unknown statuses rejected.
- Permission evaluator: every non-active state denied.

## Database (executed on staging)
- Suspended user: zero rows via RLS; `app.is_active_user()=false`.

## E2E (implemented specs)
- Protected-route redirects; login error handling; non-enumerating reset; sign-in/out flow (staging account, env-gated).

## Manual (staging, owner/CI)
- Full invite → email → set-password → active loop (needs mailbox).
- Suspend an active session's user → next privileged action fails; token refresh blocked.
