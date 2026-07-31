# Authentication Module — Specification (Phase 01)

## Purpose
Individual user accounts (no shared accounts), email/password sign-in, invitations, password reset, account states, and server-side session verification.

## Business owner
System owner.

## Users
All system users; Owner/Administrators manage accounts.

## Entities and tables
Supabase `auth.users` + `public.user_profiles` (1:1 via trigger `app.handle_new_user`, migration 20260731100002). Profile carries `account_status` (`invited/active/suspended/locked/disabled/exited`).

## Flows (implemented)
- Invitation: `inviteUser` service → `auth.admin.inviteUserByEmail` → `/auth/confirm` → `/set-password` → status `invited → active`.
- Sign-in: email/password; post-auth account-state gate signs non-active users straight back out.
- Sign-out, password reset (non-enumerating), protected routes (middleware + server layout).
- Suspension: profile status + auth-level ban (`ban_duration`) → token refresh blocked immediately; RLS returns zero rows regardless.

## Status workflow
See `AUTHENTICATION_WORKFLOW.md`.

## Permissions
`users.view/invite/update/suspend` (see `AUTHENTICATION_PERMISSION_MATRIX.md`).

## Approval requirements
None in Phase 01; every state change requires a recorded reason and is audited.

## Validation rules
Email normalization, 12-char minimum password, Zod at every boundary (`server/validation/auth.ts`, `users.ts`).

## MFA (prepared, not implemented)
Supabase Auth MFA (TOTP) can be enabled per user without schema changes; the account-state gate and session verification are the integration points. Owner/Administrator MFA enforcement is deferred by owner decision — tracked in the phase doc.

## Error handling
Non-enumerating reset responses; generic invalid-credential errors; blocked-state messages without internals; failures audited.

## Tests
`AUTHENTICATION_TEST_PLAN.md`.

## Completion criteria
All flows above implemented, audited, and covered by the listed tests. Status: implemented in Phase 01.
