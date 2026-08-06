-- Migration: fix mutable search_path on the two guard functions (Phase 05)
-- Purpose: Supabase advisors flagged app.stock_ledger_is_immutable and
--          app.stock_balances_are_derived as having a role-mutable
--          search_path. Both only raise exceptions so the exposure was
--          small, but a pinned search_path is the standing rule here.
-- Rollback: recreate both without `set search_path` (not recommended).
create or replace function app.stock_ledger_is_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception
    'stock_ledger is append-only: % is not permitted. Post a compensating entry instead.',
    tg_op
    using errcode = 'P0001';
end;
$$;

create or replace function app.stock_balances_are_derived()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(nullif(current_setting('app.ledger_posting', true), ''), 'false') <> 'true' then
    raise exception
      'stock_balances is derived from stock_ledger and cannot be written directly (%). Post a ledger entry instead.',
      tg_op
      using errcode = 'P0001';
  end if;
  return case tg_op when 'DELETE' then old else new end;
end;
$$;
