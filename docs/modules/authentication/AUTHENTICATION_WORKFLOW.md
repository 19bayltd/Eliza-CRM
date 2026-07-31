# Authentication Module — Account-State Workflow

```
invited ──(set password via invite link)──► active
invited ──► disabled
active ──► suspended | locked | disabled | exited
suspended ──► active | disabled | exited
locked ──► active | disabled
disabled ──► active | exited
exited ──► (terminal)
```
Enforced in `server/services/users.ts` (`ALLOWED_TRANSITIONS`); invalid transitions raise `invalid_status_transition`. Non-active states also apply an auth-level ban; returning to `active` lifts it. Self-status-change is forbidden.
