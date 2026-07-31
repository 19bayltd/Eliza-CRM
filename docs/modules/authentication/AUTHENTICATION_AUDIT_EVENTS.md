# Authentication Module — Audit Events (Phase 01, implemented)

| Event | Trigger | Notes |
|---|---|---|
| auth.user.invited | Invitation sent | email, name, role, companies |
| auth.user.activated | Invite completed (invited→active) | status change |
| auth.user.login_succeeded | Sign-in OK | non-critical write |
| auth.user.login_failed | Bad credentials | failure + reason |
| auth.user.login_blocked | Non-active account sign-in attempt | failure + account state |
| auth.user.signed_out | Sign-out | non-critical |
| auth.user.password_reset_requested | Reset requested | email only |
| auth.user.password_changed | Password updated | no values |
| auth.user.status_changed | Admin state transition | previous/new + reason |
| auth.user.role_assigned / role_revoked | Role grants | role + company binding |
| auth.user.scope_granted / scope_revoked | Company scope grants | company |
| auth.user.bootstrap_owner | One-time owner bootstrap | via scripts/bootstrap-owner.mjs |

No passwords, tokens, or secrets are ever written (enforced by `sanitizeAuditValue` + review).
