-- Migration: transfers, adjustments and counts join the numbering scheme
-- Purpose: Phase 05 adds TRF, ADJ and CNT document types.
-- Rollback: restore the previous type list in both the function and the
--           document_sequences check constraint.
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
  if p_doc_type not in ('PR', 'PO', 'GRN', 'SR', 'TRF', 'ADJ', 'CNT') then
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

revoke execute on function public.next_document_number(uuid, text)
  from public, anon, authenticated;
grant execute on function public.next_document_number(uuid, text) to service_role;

alter table public.document_sequences drop constraint document_sequences_type_valid;
alter table public.document_sequences add constraint document_sequences_type_valid
  check (doc_type in ('PR', 'PO', 'GRN', 'SR', 'TRF', 'ADJ', 'CNT'));
