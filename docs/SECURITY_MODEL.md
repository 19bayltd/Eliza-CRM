# Eliza OS — Security Model

Security is a system-wide requirement from the first line of code, not a
final-phase feature.

## 1. Data classification

| Classification | Examples | Handling |
|---|---|---|
| **Public** | Public product marketing images, public descriptions, public category info | May be publicly served |
| **Internal** | Internal tasks, SOPs, operational notes, internal department reports | Authenticated + scoped access |
| **Confidential** | Supplier prices, purchase costs, supplier quotations, sourcing research, customer export files, internal profitability | Specific permission + audit on access/export |
| **Highly Confidential** | Employee NID, salary, bank documents, authentication secrets, private agreements, highly sensitive financials | Narrow permission, server-side only, every access audited, short-lived URLs only |

Permissions, storage, exports, auditing, and viewing controls must reflect
the classification of the data involved.

## 2. Absolute prohibitions

Never:
- Trust client-supplied company IDs, prices, or permissions.
- Put service-role keys in the browser.
- Store secrets in source control.
- Expose employee documents publicly.
- Expose supplier costs to unauthorized users.
- Allow cross-company record access.
- Log passwords or tokens.
- Use hidden interface elements as authorization.
- Allow completed financial transactions to be silently edited.
- Allow completed sales to be deleted.
- Allow direct stock-balance editing.
- Expose sensitive exports without authorization and audit logging.

## 3. Enforcement layers

1. **Server boundary** — every privileged operation authenticates,
   authorizes (see `ROLE_PERMISSION_MATRIX.md`), validates input (Zod),
   and audits.
2. **Database (RLS + constraints)** — company/branch scoping enforced by
   RLS so a server-layer bug cannot leak cross-company data.
3. **Storage** — private buckets, short-lived signed URLs, access logging
   (see `FILE_STORAGE_POLICY.md`).

Frontend restrictions (hidden buttons, disabled fields) are UX only.

## 4. Accounts and access

- Every operational user has an individual account; shared accounts are
  prohibited.
- Account states: Invited, Active, Suspended, Locked, Disabled, Exited.
- The owner can suspend a user and invalidate access immediately.
- Developers do not get production employee-document access by default;
  production access is limited, justified, time-bound where possible, and
  auditable.

## 5. Secrets

- Secrets live in Vercel/Supabase environment configuration.
- `.env*` files are gitignored; a committed `.env.example` documents
  required variable names only.
- Audit logs never contain passwords, tokens, or secrets.

## 6. Approvals

Sensitive actions may require approval per `docs/phases/` and module specs
(stock adjustment, refunds, cancellations, purchase orders, price changes,
threshold discounts, employee-document download, large exports, salary
changes, financial corrections, costing-rule changes). Approved records are
never silently modified — use amendments, reversals, or new approvals.

## 7. AI constraints

AI must never independently approve refunds, change stock, change supplier
costs, change financial records, terminate employees, export customer data,
place purchase orders, change salaries, or change access permissions. AI
outputs cite internal sources, show date ranges and uncertainty, and
require human approval for sensitive actions.

## 8. Security review cadence

Every phase completion includes a security review recorded in
`docs/audits/SECURITY_AUDIT_LOG.md`. No phase is complete with an
unresolved critical security issue.
