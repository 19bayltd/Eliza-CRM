-- Migration: ledger immutability, derived balances, RLS (Phase 05)
-- Purpose: make the two rules that the whole module rests on
--          unbypassable — a ledger row never changes, and a balance can
--          only move because a ledger row was written.
-- Rollback: drop triggers stock_ledger_no_update, stock_ledger_no_delete,
--           stock_ledger_apply_balance; drop the three functions; drop
--           the select policies.
-- Notes: the negative-stock check lives in the balance trigger rather
--        than in a service, so it applies to every future phase's
--        postings (POS sales, order reservations) without those phases
--        having to remember it.

create or replace function app.stock_ledger_is_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'stock_ledger is append-only: % is not permitted. Post a compensating entry instead.',
    tg_op
    using errcode = 'P0001';
end;
$$;

create trigger stock_ledger_no_update
  before update on public.stock_ledger
  for each row execute function app.stock_ledger_is_immutable();

create trigger stock_ledger_no_delete
  before delete on public.stock_ledger
  for each row execute function app.stock_ledger_is_immutable();

-- The only writer of stock_balances, and the place negative stock is
-- refused. The override must be set for the duration of the statement by
-- a caller that holds the override permission, and is cleared straight
-- after — see public.post_stock_entries.
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
  insert into public.stock_balances as b
    (company_id, warehouse_id, product_id, variant_id, quantity, updated_at)
  values
    (new.company_id, new.warehouse_id, new.product_id, new.variant_id, new.quantity, now())
  on conflict (warehouse_id, product_id, variant_id) do update
    set quantity = b.quantity + excluded.quantity,
        updated_at = now()
  returning quantity into v_new_qty;

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

create trigger stock_ledger_apply_balance
  after insert on public.stock_ledger
  for each row execute function app.stock_ledger_apply_balance();

create or replace function app.stock_balances_are_derived()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'stock_balances is derived from stock_ledger and cannot be written directly'
    using errcode = 'P0001';
end;
$$;

revoke insert, update, delete, truncate on public.stock_balances from anon, authenticated;
revoke insert, update, delete, truncate on public.stock_ledger from anon, authenticated;
revoke insert, update, delete, truncate on
  public.warehouse_locations, public.stock_transfers, public.stock_transfer_lines,
  public.stock_adjustments, public.stock_adjustment_lines, public.stock_counts,
  public.stock_count_lines, public.stock_documents
from anon, authenticated;

alter table public.stock_ledger enable row level security;
alter table public.stock_balances enable row level security;
alter table public.warehouse_locations enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_lines enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.stock_adjustment_lines enable row level security;
alter table public.stock_counts enable row level security;
alter table public.stock_count_lines enable row level security;
alter table public.stock_documents enable row level security;

create policy stock_ledger_select on public.stock_ledger
  for select to authenticated using (app.has_permission('inventory.view', company_id));
create policy stock_balances_select on public.stock_balances
  for select to authenticated using (app.has_permission('inventory.view', company_id));
create policy warehouse_locations_select on public.warehouse_locations
  for select to authenticated using (app.has_permission('inventory.view', company_id));
create policy stock_transfers_select on public.stock_transfers
  for select to authenticated using (app.has_permission('inventory.view', company_id));
create policy stock_transfer_lines_select on public.stock_transfer_lines
  for select to authenticated using (app.has_permission('inventory.view', company_id));
create policy stock_adjustments_select on public.stock_adjustments
  for select to authenticated using (app.has_permission('inventory.view', company_id));
create policy stock_adjustment_lines_select on public.stock_adjustment_lines
  for select to authenticated using (app.has_permission('inventory.view', company_id));
create policy stock_counts_select on public.stock_counts
  for select to authenticated using (app.has_permission('inventory.view', company_id));
create policy stock_count_lines_select on public.stock_count_lines
  for select to authenticated using (app.has_permission('inventory.view', company_id));
create policy stock_documents_select on public.stock_documents
  for select to authenticated using (app.has_permission('inventory.document.download', company_id));
