# Organization Module — Test Plan (Phase 01)

## Unit (implemented — tests/unit)
- Validation: approved company codes incl. digit-leading `19BAY`; bad codes/currencies/names rejected.
- Permission evaluator: scoped/global grants, wrong company, inactive accounts.

## Database (executed on staging — scripts/rls-verification.sql)
- Scoped SELECT only within granted companies; INSERT/UPDATE denied to clients (42501).

## Integration (env-gated — tests/integration)
- RLS isolation via signed-in client: single visible company, writes rejected.

## E2E (tests/e2e)
- Admin organization page flows (extend when staging E2E account provisioned).

## Outstanding
- Service-level integration tests for create/update/archive against staging run in CI once staging credentials are configured there.
