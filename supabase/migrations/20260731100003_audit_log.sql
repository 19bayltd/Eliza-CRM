-- Migration: audit log foundation
-- Purpose: append-only audit trail for every sensitive action.
-- Rollback: drop table public.audit_log; drop function app.audit_log_block_mutation.
-- Notes: additive only. The table is append-only for every database role:
--        a trigger raises on UPDATE/DELETE, so even service-role code
--        cannot rewrite history. Reads are server-side only (no RLS
--        policies for clients), gated by the audit.log.view permission in
--        the server layer. Audit rows must never contain passwords,
--        tokens, or secrets — enforced additionally in the audit service.

create table public.audit_log (
  id                 bigint generated always as identity primary key,
  occurred_at        timestamptz not null default now(),
  actor_user_id      uuid references auth.users (id),
  actor_email        text,
  company_id         uuid references public.companies (id),
  branch_id          uuid references public.branches (id),
  module             text not null,
  action             text not null,
  entity_type        text,
  entity_id          text,
  previous_value     jsonb,
  new_value          jsonb,
  reason             text,
  approval_reference text,
  request_id         uuid,
  ip_address         inet,
  user_agent         text,
  result             text not null default 'success'
                     constraint audit_log_result_valid check (result in ('success', 'failure')),
  failure_reason     text
);

create index audit_log_company_time_idx on public.audit_log (company_id, occurred_at desc);
create index audit_log_actor_time_idx on public.audit_log (actor_user_id, occurred_at desc);
create index audit_log_module_action_idx on public.audit_log (module, action);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);

create or replace function app.audit_log_block_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only; % is not permitted', tg_op;
end;
$$;

create trigger audit_log_no_update
  before update on public.audit_log
  for each row execute function app.audit_log_block_mutation();

create trigger audit_log_no_delete
  before delete on public.audit_log
  for each row execute function app.audit_log_block_mutation();

-- Clients have no direct access at all; the server writes via service role
-- and reads on behalf of users holding audit.log.view.
revoke all on public.audit_log from anon, authenticated;
