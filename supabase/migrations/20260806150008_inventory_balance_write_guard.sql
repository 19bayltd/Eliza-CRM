-- Migration: enforce "balances only move through the ledger" (Phase 05)
-- Purpose: close two self-review findings.
--   1. app.stock_balances_are_derived() was defined but never attached to
--      a trigger, so the documented rule was unenforced — the service
--      role could write balances directly and desynchronise them from the
--      ledger without anything noticing.
--   2. post_stock_entries left the negative-stock override set if a
--      ledger insert raised mid-batch. Each RPC is its own transaction so
--      the practical blast radius was nil, but a permission flag should
--      not outlive the failure that interrupted it.
-- Rollback: drop trigger stock_balances_derived_only on public.stock_balances;
--           restore the prior function bodies from 20260806150003/150006.

create or replace function app.stock_balances_are_derived()
returns trigger
language plpgsql
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

create trigger stock_balances_derived_only
  before insert or update or delete on public.stock_balances
  for each row execute function app.stock_balances_are_derived();

-- The ledger trigger raises the flag around its own write and lowers it
-- immediately, so the window is exactly one statement wide.
create or replace function app.stock_ledger_apply_balance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_qty integer;
  v_allow_negative boolean := coalesce(
    nullif(current_setting('app.allow_negative_stock', true), '')::boolean, false);
  v_sku text;
begin
  perform set_config('app.ledger_posting', 'true', true);

  insert into public.stock_balances as b
    (company_id, warehouse_id, product_id, variant_id, quantity, updated_at)
  values
    (new.company_id, new.warehouse_id, new.product_id, new.variant_id, new.quantity, now())
  on conflict (warehouse_id, product_id, variant_id) do update
    set quantity = b.quantity + excluded.quantity,
        updated_at = now()
  returning quantity into v_new_qty;

  perform set_config('app.ledger_posting', 'false', true);

  if v_new_qty < 0 and not v_allow_negative then
    select sku into v_sku from public.products where id = new.product_id;
    raise exception
      'Insufficient stock for % in this warehouse: balance would become %',
      coalesce(v_sku, new.product_id::text), v_new_qty
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.post_stock_entries(
  p_company_id     uuid,
  p_entries        jsonb,
  p_actor          uuid,
  p_allow_negative boolean default false
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entry jsonb;
  v_count integer := 0;
begin
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'No stock entries supplied' using errcode = '22023';
  end if;

  if p_allow_negative then
    perform set_config('app.allow_negative_stock', 'true', true);
  end if;

  begin
    for v_entry in select * from jsonb_array_elements(p_entries)
    loop
      insert into public.stock_ledger (
        company_id, warehouse_id, location_id, product_id, variant_id,
        txn_type, quantity, reference_type, reference_id, reference_number,
        reason, created_by
      ) values (
        p_company_id,
        (v_entry ->> 'warehouse_id')::uuid,
        nullif(v_entry ->> 'location_id', '')::uuid,
        (v_entry ->> 'product_id')::uuid,
        nullif(v_entry ->> 'variant_id', '')::uuid,
        v_entry ->> 'txn_type',
        (v_entry ->> 'quantity')::integer,
        nullif(v_entry ->> 'reference_type', ''),
        nullif(v_entry ->> 'reference_id', '')::uuid,
        nullif(v_entry ->> 'reference_number', ''),
        nullif(v_entry ->> 'reason', ''),
        p_actor
      );
      v_count := v_count + 1;
    end loop;
  exception when others then
    perform set_config('app.allow_negative_stock', 'false', true);
    raise;
  end;

  perform set_config('app.allow_negative_stock', 'false', true);
  return v_count;
end;
$$;

revoke execute on function public.post_stock_entries(uuid, jsonb, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.post_stock_entries(uuid, jsonb, uuid, boolean) to service_role;
