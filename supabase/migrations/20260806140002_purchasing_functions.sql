-- Migration: purchasing transactional functions (Phase 04)
-- Purpose: per-company document numbering under a row lock, and atomic
--          purchase receiving per DATABASE_ARCHITECTURE.md §6.
-- Rollback: drop function public.record_purchase_receipt(uuid, uuid, jsonb, text, uuid);
--           drop function public.next_document_number(uuid, text).
-- Notes: both are SECURITY DEFINER and callable by the service role only
--        (execute revoked from anon/authenticated). They live in public
--        because PostgREST resolves rpc() against exposed schemas only.
--        Authorization happens in the server services before these run;
--        the functions guarantee integrity, not permission.

-- Allocate the next number for a company/type/year. The upsert takes a
-- row lock, so two simultaneous submissions cannot receive the same
-- number — the second waits and gets n+1.
create or replace function public.next_document_number(
  p_company_id uuid,
  p_doc_type   text
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year integer := extract(year from now())::integer;
  v_next integer;
begin
  if p_doc_type not in ('PR', 'PO', 'GRN', 'SR') then
    raise exception 'Unknown document type %', p_doc_type
      using errcode = '22023';
  end if;

  insert into public.document_sequences (company_id, doc_type, year, last_value)
  values (p_company_id, p_doc_type, v_year, 1)
  on conflict (company_id, doc_type, year) do update
    set last_value = public.document_sequences.last_value + 1
  returning last_value into v_next;

  return format('%s-%s-%s', p_doc_type, v_year, lpad(v_next::text, 4, '0'));
end;
$$;

revoke execute on function public.next_document_number(uuid, text) from anon, authenticated;

-- Record a receipt atomically: header + lines + purchase-order status,
-- all in one transaction. Any failure rolls back the entire receipt —
-- there is no such thing as a half-recorded delivery.
--
-- p_lines: jsonb array of
--   {order_line_id, accepted_qty, damaged_qty, missing_qty, extra_qty, note}
--
-- Returns the created receipt id, its number, and the resulting order
-- status so the caller can audit precisely what happened.
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
begin
  -- Lock the order for the duration: concurrent receipts serialize here,
  -- so two deliveries recorded at once cannot both read a stale status.
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
      raise exception 'Receipt line does not belong to this order'
        using errcode = '22023';
    end if;

    insert into public.purchase_receipt_lines (
      company_id, receipt_id, order_line_id,
      accepted_qty, damaged_qty, missing_qty, extra_qty, note, created_by
    ) values (
      p_company_id, v_receipt_id, v_order_line.id,
      coalesce((v_line ->> 'accepted_qty')::integer, 0),
      coalesce((v_line ->> 'damaged_qty')::integer, 0),
      coalesce((v_line ->> 'missing_qty')::integer, 0),
      coalesce((v_line ->> 'extra_qty')::integer, 0),
      nullif(trim(coalesce(v_line ->> 'note', '')), ''),
      p_actor
    );
  end loop;

  -- Completion is judged on accepted quantities across every receipt for
  -- the order: damaged and missing units do not count as delivered.
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

revoke execute on function
  public.record_purchase_receipt(uuid, uuid, jsonb, text, uuid)
from anon, authenticated;

-- Revoking from anon/authenticated alone is insufficient: PostgreSQL grants
-- EXECUTE to PUBLIC by default and those roles inherit it, which left both
-- functions callable through /rest/v1/rpc by anonymous callers (caught by
-- the Supabase security advisors, migration 20260806140004). Revoke from
-- PUBLIC and grant only to service_role — the role the server services use.
revoke execute on function public.next_document_number(uuid, text)
  from public, anon, authenticated;
revoke execute on function
  public.record_purchase_receipt(uuid, uuid, jsonb, text, uuid)
  from public, anon, authenticated;

grant execute on function public.next_document_number(uuid, text) to service_role;
grant execute on function
  public.record_purchase_receipt(uuid, uuid, jsonb, text, uuid) to service_role;
