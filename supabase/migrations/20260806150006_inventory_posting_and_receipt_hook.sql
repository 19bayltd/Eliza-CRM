-- Migration: batch stock posting + Phase 04 receiving hook (Phase 05)
-- Purpose: one function to post a batch of ledger entries atomically, and
--          the change that makes purchase receiving move stock in the
--          same transaction as the receipt.
-- Rollback: drop function public.post_stock_entries(uuid, jsonb, uuid, boolean);
--           restore record_purchase_receipt from 20260806140005;
--           alter table public.purchase_orders drop column warehouse_id.
-- Notes: the negative-stock override is scoped with set_config(..., true)
--        — local to the transaction — and cleared before returning, so it
--        cannot leak into a later statement on the same connection.

alter table public.purchase_orders
  add column warehouse_id uuid references public.warehouses (id) on delete restrict,
  add constraint purchase_orders_warehouse_company_fkey
    foreign key (warehouse_id, company_id)
    references public.warehouses (id, company_id) on delete restrict;

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

  perform set_config('app.allow_negative_stock', 'false', true);
  return v_count;
end;
$$;

revoke execute on function public.post_stock_entries(uuid, jsonb, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.post_stock_entries(uuid, jsonb, uuid, boolean) to service_role;

-- Receiving posts stock in the SAME transaction as the receipt. If the
-- ledger refuses, the whole receipt rolls back: there is no state where a
-- GRN exists but stock disagrees with it.
create or replace function public.record_purchase_receipt(
  p_company_id uuid,
  p_order_id   uuid,
  p_lines      jsonb,
  p_note       text,
  p_actor      uuid
) returns table (receipt_id uuid, receipt_number text, order_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order        public.purchase_orders%rowtype;
  v_receipt_id   uuid;
  v_number       text;
  v_line         jsonb;
  v_order_line   public.purchase_order_lines%rowtype;
  v_all_complete boolean := true;
  v_any_received boolean := false;
  v_status       text;
  v_accepted     integer;
  v_extra        integer;
  v_outstanding  integer;
begin
  select * into v_order
  from public.purchase_orders
  where id = p_order_id and company_id = p_company_id
  for update;

  if not found then
    raise exception 'Purchase order not found' using errcode = 'P0002';
  end if;

  if v_order.status not in ('issued', 'partially_received') then
    raise exception 'Only issued orders can be received (status: %)', v_order.status
      using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A receipt needs at least one line' using errcode = '22023';
  end if;

  v_number := public.next_document_number(p_company_id, 'GRN');

  insert into public.purchase_receipts (company_id, number, order_id, note, created_by)
  values (p_company_id, v_number, p_order_id, nullif(trim(coalesce(p_note, '')), ''), p_actor)
  returning id into v_receipt_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    select * into v_order_line
    from public.purchase_order_lines
    where id = (v_line ->> 'order_line_id')::uuid
      and order_id = p_order_id
      and company_id = p_company_id;

    if not found then
      raise exception 'Receipt line does not belong to this order' using errcode = '22023';
    end if;

    v_accepted := coalesce((v_line ->> 'accepted_qty')::integer, 0);
    v_extra    := coalesce((v_line ->> 'extra_qty')::integer, 0);

    select v_order_line.quantity_ordered - coalesce(sum(rl.accepted_qty), 0)
    into v_outstanding
    from public.purchase_receipt_lines rl
    where rl.order_line_id = v_order_line.id;

    if v_outstanding < 0 then v_outstanding := 0; end if;

    if v_accepted > v_outstanding then
      v_extra := v_extra + (v_accepted - v_outstanding);
      v_accepted := v_outstanding;
    end if;

    insert into public.purchase_receipt_lines (
      company_id, receipt_id, order_line_id,
      accepted_qty, damaged_qty, missing_qty, extra_qty, note, created_by
    ) values (
      p_company_id, v_receipt_id, v_order_line.id,
      v_accepted,
      coalesce((v_line ->> 'damaged_qty')::integer, 0),
      coalesce((v_line ->> 'missing_qty')::integer, 0),
      v_extra,
      nullif(trim(coalesce(v_line ->> 'note', '')), ''),
      p_actor
    );

    -- PHASE 05: accepted units enter stock here, atomically with the
    -- receipt. Damaged, missing and extra do NOT post — damaged goods are
    -- not sellable stock, missing never arrived, and extra is a
    -- discrepancy to settle with the supplier before it becomes stock.
    if v_accepted > 0 and v_order.warehouse_id is not null then
      insert into public.stock_ledger (
        company_id, warehouse_id, product_id, variant_id, txn_type, quantity,
        reference_type, reference_id, reference_number, reason, created_by
      ) values (
        p_company_id, v_order.warehouse_id, v_order_line.product_id, v_order_line.variant_id,
        'purchase_receipt', v_accepted,
        'purchase_receipt', v_receipt_id, v_number,
        format('Received against %s', v_order.number), p_actor
      );
    end if;
  end loop;

  select
    bool_and(received.accepted >= line.quantity_ordered),
    bool_or(received.accepted > 0)
  into v_all_complete, v_any_received
  from public.purchase_order_lines line
  cross join lateral (
    select coalesce(sum(rl.accepted_qty), 0) as accepted
    from public.purchase_receipt_lines rl
    where rl.order_line_id = line.id
  ) received
  where line.order_id = p_order_id;

  v_status := case
    when v_all_complete then 'received'
    when v_any_received then 'partially_received'
    else v_order.status
  end;

  update public.purchase_orders
  set status = v_status, updated_by = p_actor
  where id = p_order_id;

  return query select v_receipt_id, v_number, v_status;
end;
$$;

revoke execute on function public.record_purchase_receipt(uuid, uuid, jsonb, text, uuid)
  from public, anon, authenticated;
grant execute on function public.record_purchase_receipt(uuid, uuid, jsonb, text, uuid) to service_role;
