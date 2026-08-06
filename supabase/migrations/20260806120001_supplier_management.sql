-- Migration: supplier management (Phase 03)
-- Purpose: suppliers, contacts, confidential quotations (price data split
--          into its own RLS-walled table, mirroring product_intelligence),
--          and the supplier-document registry.
-- Rollback: drop tables supplier_documents, supplier_quotation_costs,
--           supplier_quotations, supplier_contacts, suppliers.
-- Notes: additive only. Archive-only lifecycle. Writes are server-side
--        only after permission checks; clients get permission-gated reads
--        via RLS. Money is numeric, never float; quotation unit prices
--        carry 4 decimals, exchange rates 6.

create table public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete restrict,
  code         text not null
               constraint suppliers_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  name         text not null constraint suppliers_name_not_blank check (length(trim(name)) > 0),
  country      char(2) not null
               constraint suppliers_country_format check (country ~ '^[A-Z]{2}$'),
  address      text,
  capabilities text,
  notes        text,
  status       text not null default 'active'
               constraint suppliers_status_valid check (status in ('active', 'archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id),
  updated_by   uuid references auth.users (id),
  unique (company_id, code)
);

create table public.supplier_contacts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete restrict,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  name        text not null constraint supplier_contacts_name_not_blank check (length(trim(name)) > 0),
  role_title  text,
  phone       text,
  messaging   text,
  email       text,
  status      text not null default 'active'
              constraint supplier_contacts_status_valid check (status in ('active', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  updated_by  uuid references auth.users (id)
);

-- Quotation metadata: existence, terms, logistics — visible with
-- suppliers.quotation.view. Prices live in the costs table below.
create table public.supplier_quotations (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete restrict,
  supplier_id    uuid not null references public.suppliers (id) on delete restrict,
  product_id     uuid not null references public.products (id) on delete restrict,
  variant_id     uuid references public.product_variants (id) on delete restrict,
  moq            integer constraint supplier_quotations_moq_positive check (moq is null or moq > 0),
  lead_time_days integer constraint supplier_quotations_lead_positive check (lead_time_days is null or lead_time_days > 0),
  valid_until    date,
  terms          text,
  status         text not null default 'active'
                 constraint supplier_quotations_status_valid check (status in ('active', 'archived')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id),
  updated_by     uuid references auth.users (id)
);

-- Confidential price data: separate table so RLS can wall it off from
-- users holding only quotation.view (same pattern as product_intelligence).
-- exchange_rate = units of the company's base currency per 1 unit of the
-- quote currency, captured at quote time so history stays accurate.
create table public.supplier_quotation_costs (
  quotation_id  uuid primary key references public.supplier_quotations (id) on delete restrict,
  company_id    uuid not null references public.companies (id) on delete restrict,
  unit_price    numeric(14, 4) not null
                constraint quotation_costs_price_positive check (unit_price > 0),
  currency      char(3) not null
                constraint quotation_costs_currency_format check (currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(16, 6) not null default 1
                constraint quotation_costs_rate_positive check (exchange_rate > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id),
  updated_by    uuid references auth.users (id)
);

-- Private supplier documents: registry rows over file_metadata objects in
-- the supplier-documents bucket.
create table public.supplier_documents (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete restrict,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  file_id     uuid not null references public.file_metadata (id) on delete restrict,
  title       text,
  status      text not null default 'active'
              constraint supplier_documents_status_valid check (status in ('active', 'deleted')),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  unique (file_id)
);

create index suppliers_company_idx on public.suppliers (company_id);
create index supplier_contacts_company_idx on public.supplier_contacts (company_id);
create index supplier_contacts_supplier_idx on public.supplier_contacts (supplier_id);
create index supplier_quotations_company_idx on public.supplier_quotations (company_id);
create index supplier_quotations_supplier_idx on public.supplier_quotations (supplier_id);
create index supplier_quotations_product_idx on public.supplier_quotations (product_id);
create index supplier_quotation_costs_company_idx on public.supplier_quotation_costs (company_id);
create index supplier_documents_company_idx on public.supplier_documents (company_id);
create index supplier_documents_supplier_idx on public.supplier_documents (supplier_id);

create trigger set_updated_at before update on public.suppliers
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.supplier_contacts
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.supplier_quotations
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.supplier_quotation_costs
  for each row execute function app.set_updated_at();

revoke insert, update, delete, truncate on
  public.suppliers, public.supplier_contacts, public.supplier_quotations,
  public.supplier_quotation_costs, public.supplier_documents
from anon, authenticated;

alter table public.suppliers enable row level security;
alter table public.supplier_contacts enable row level security;
alter table public.supplier_quotations enable row level security;
alter table public.supplier_quotation_costs enable row level security;
alter table public.supplier_documents enable row level security;

-- Suppliers and contacts: permission-gated (viewer role holds no
-- supplier permission by default, unlike products).
create policy suppliers_select on public.suppliers
  for select to authenticated
  using (app.has_permission('suppliers.view', company_id));

create policy supplier_contacts_select on public.supplier_contacts
  for select to authenticated
  using (app.has_permission('suppliers.view', company_id));

-- Quotation metadata: needs the quotation permission on top of scope.
create policy supplier_quotations_select on public.supplier_quotations
  for select to authenticated
  using (app.has_permission('suppliers.quotation.view', company_id));

-- Prices: the cost permission alone unlocks this table.
create policy supplier_quotation_costs_select on public.supplier_quotation_costs
  for select to authenticated
  using (app.has_permission('suppliers.quotation.cost.view', company_id));

create policy supplier_documents_select on public.supplier_documents
  for select to authenticated
  using (app.has_permission('suppliers.document.download', company_id));
