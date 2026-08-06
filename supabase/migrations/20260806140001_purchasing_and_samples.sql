-- Migration: purchasing and samples (Phase 04)
-- Purpose: purchase requests with a configurable approval engine,
--          purchase orders with an RLS-walled cost table, atomic
--          receiving (accepted/damaged/missing/extra), sample requests,
--          and the purchase-document registry.
-- Rollback: drop, in order: purchase_documents, purchase_receipt_lines,
--           purchase_receipts, purchase_order_line_costs,
--           purchase_order_lines, purchase_orders, sample_requests,
--           purchase_request_lines, purchase_requests, approval_records,
--           approval_rules, document_sequences.
-- Notes: additive only. Nothing is deleted at runtime — cancellation and
--        rejection are status transitions. Money is numeric, never float.
--        Child rows are pinned to their parent's company by composite
--        (id, company_id) foreign keys, as in migration 20260806130001.

-- ---------------------------------------------------------------------
-- Numbering: one sequence row per company, document type, and year.
-- ---------------------------------------------------------------------
create table public.document_sequences (
  company_id uuid not null references public.companies (id) on delete restrict,
  doc_type   text not null
             constraint document_sequences_type_valid
             check (doc_type in ('PR', 'PO', 'GRN', 'SR')),
  year       integer not null
             constraint document_sequences_year_sane check (year between 2000 and 2999),
  last_value integer not null default 0
             constraint document_sequences_value_positive check (last_value >= 0),
  primary key (company_id, doc_type, year)
);

-- ---------------------------------------------------------------------
-- Approval engine: requirements are data, never hard-coded thresholds.
-- The highest matching min_amount wins; boundary escalates at >=.
-- ---------------------------------------------------------------------
create table public.approval_rules (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete restrict,
  action              text not null
                      constraint approval_rules_action_not_blank check (length(trim(action)) > 0),
  min_amount          numeric(14, 4) not null default 0
                      constraint approval_rules_amount_positive check (min_amount >= 0),
  required_permission text not null
                      references public.permissions (key) on delete restrict,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users (id),
  updated_by          uuid references auth.users (id),
  unique (company_id, action, min_amount)
);

-- Master approval-record shape (GLOSSARY.md): request/decision pair.
create table public.approval_records (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete restrict,
  module         text not null,
  entity_type    text not null,
  entity_id      uuid not null,
  entity_number  text,
  requested_by   uuid not null references auth.users (id),
  requested_at   timestamptz not null default now(),
  approver_id    uuid references auth.users (id),
  decided_at     timestamptz,
  status         text not null default 'pending'
                 constraint approval_records_status_valid
                 check (status in ('pending', 'approved', 'rejected')),
  rule_applied   text,
  previous_value jsonb,
  proposed_value jsonb,
  reason         text,
  note           text,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Purchase requests
-- ---------------------------------------------------------------------
create table public.purchase_requests (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete restrict,
  number          text not null
                  constraint purchase_requests_number_format
                  check (number ~ '^PR-[0-9]{4}-[0-9]{4,}$'),
  title           text not null
                  constraint purchase_requests_title_not_blank check (length(trim(title)) > 0),
  justification   text,
  needed_by       date,
  status          text not null default 'draft'
                  constraint purchase_requests_status_valid
                  check (status in ('draft', 'submitted', 'approved', 'rejected', 'ordered', 'cancelled')),
  -- Total frozen at submission: the approver decides against the amount
  -- they were shown, not a later recomputation.
  submitted_total numeric(14, 4)
                  constraint purchase_requests_total_positive
                  check (submitted_total is null or submitted_total >= 0),
  submitted_at    timestamptz,
  submitted_by    uuid references auth.users (id),
  decided_at      timestamptz,
  decided_by      uuid references auth.users (id),
  decision_reason text,
  rule_applied    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id),
  updated_by      uuid references auth.users (id),
  unique (company_id, number),
  unique (id, company_id)
);

create table public.purchase_request_lines (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies (id) on delete restrict,
  request_id           uuid not null references public.purchase_requests (id) on delete restrict,
  product_id           uuid not null references public.products (id) on delete restrict,
  variant_id           uuid references public.product_variants (id) on delete restrict,
  quantity             integer not null
                       constraint purchase_request_lines_qty_positive
                       check (quantity > 0 and quantity <= 1000000),
  -- Internal estimate in the company base currency (not a supplier cost).
  estimated_unit_price numeric(14, 4) not null
                       constraint purchase_request_lines_price_positive
                       check (estimated_unit_price >= 0),
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid references auth.users (id),
  updated_by           uuid references auth.users (id),
  constraint purchase_request_lines_request_company_fkey
    foreign key (request_id, company_id)
    references public.purchase_requests (id, company_id) on delete restrict,
  constraint purchase_request_lines_product_company_fkey
    foreign key (product_id, company_id)
    references public.products (id, company_id) on delete restrict
);

-- ---------------------------------------------------------------------
-- Purchase orders (metadata) and their walled costs
-- ---------------------------------------------------------------------
create table public.purchase_orders (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete restrict,
  number          text not null
                  constraint purchase_orders_number_format
                  check (number ~ '^PO-[0-9]{4}-[0-9]{4,}$'),
  supplier_id     uuid not null references public.suppliers (id) on delete restrict,
  request_id      uuid references public.purchase_requests (id) on delete restrict,
  currency        char(3) not null
                  constraint purchase_orders_currency_format check (currency ~ '^[A-Z]{3}$'),
  -- Base-currency units per 1 unit of the order currency, frozen at issue.
  exchange_rate   numeric(16, 6) not null default 1
                  constraint purchase_orders_rate_positive check (exchange_rate > 0),
  expected_date   date,
  terms           text,
  status          text not null default 'draft'
                  constraint purchase_orders_status_valid
                  check (status in ('draft', 'issued', 'partially_received', 'received', 'cancelled')),
  issued_at       timestamptz,
  issued_by       uuid references auth.users (id),
  cancelled_at    timestamptz,
  cancel_reason   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id),
  updated_by      uuid references auth.users (id),
  unique (company_id, number),
  unique (id, company_id),
  constraint purchase_orders_supplier_company_fkey
    foreign key (supplier_id, company_id)
    references public.suppliers (id, company_id) on delete restrict,
  constraint purchase_orders_request_company_fkey
    foreign key (request_id, company_id)
    references public.purchase_requests (id, company_id) on delete restrict
);

create table public.purchase_order_lines (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete restrict,
  order_id         uuid not null references public.purchase_orders (id) on delete restrict,
  product_id       uuid not null references public.products (id) on delete restrict,
  variant_id       uuid references public.product_variants (id) on delete restrict,
  quantity_ordered integer not null
                   constraint purchase_order_lines_qty_positive
                   check (quantity_ordered > 0 and quantity_ordered <= 1000000),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id),
  updated_by       uuid references auth.users (id),
  unique (id, company_id),
  constraint purchase_order_lines_order_company_fkey
    foreign key (order_id, company_id)
    references public.purchase_orders (id, company_id) on delete restrict,
  constraint purchase_order_lines_product_company_fkey
    foreign key (product_id, company_id)
    references public.products (id, company_id) on delete restrict
);

-- Confidential: the buying price. Separate table so RLS can wall it off
-- from holders of order.view, exactly as supplier_quotation_costs does.
create table public.purchase_order_line_costs (
  line_id    uuid primary key references public.purchase_order_lines (id) on delete restrict,
  company_id uuid not null references public.companies (id) on delete restrict,
  unit_price numeric(14, 4) not null
             constraint purchase_order_line_costs_price_positive check (unit_price > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint purchase_order_line_costs_line_company_fkey
    foreign key (line_id, company_id)
    references public.purchase_order_lines (id, company_id) on delete restrict
);

-- ---------------------------------------------------------------------
-- Receiving
-- ---------------------------------------------------------------------
create table public.purchase_receipts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete restrict,
  number      text not null
              constraint purchase_receipts_number_format
              check (number ~ '^GRN-[0-9]{4}-[0-9]{4,}$'),
  order_id    uuid not null references public.purchase_orders (id) on delete restrict,
  received_at timestamptz not null default now(),
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  unique (company_id, number),
  unique (id, company_id),
  constraint purchase_receipts_order_company_fkey
    foreign key (order_id, company_id)
    references public.purchase_orders (id, company_id) on delete restrict
);

create table public.purchase_receipt_lines (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete restrict,
  receipt_id     uuid not null references public.purchase_receipts (id) on delete restrict,
  order_line_id  uuid not null references public.purchase_order_lines (id) on delete restrict,
  accepted_qty   integer not null default 0
                 constraint purchase_receipt_lines_accepted_sane
                 check (accepted_qty >= 0 and accepted_qty <= 1000000),
  damaged_qty    integer not null default 0
                 constraint purchase_receipt_lines_damaged_sane
                 check (damaged_qty >= 0 and damaged_qty <= 1000000),
  missing_qty    integer not null default 0
                 constraint purchase_receipt_lines_missing_sane
                 check (missing_qty >= 0 and missing_qty <= 1000000),
  extra_qty      integer not null default 0
                 constraint purchase_receipt_lines_extra_sane
                 check (extra_qty >= 0 and extra_qty <= 1000000),
  note           text,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id),
  constraint purchase_receipt_lines_nonzero
    check (accepted_qty + damaged_qty + missing_qty + extra_qty > 0),
  constraint purchase_receipt_lines_receipt_company_fkey
    foreign key (receipt_id, company_id)
    references public.purchase_receipts (id, company_id) on delete restrict,
  constraint purchase_receipt_lines_order_line_company_fkey
    foreign key (order_line_id, company_id)
    references public.purchase_order_lines (id, company_id) on delete restrict
);

-- ---------------------------------------------------------------------
-- Samples
-- ---------------------------------------------------------------------
create table public.sample_requests (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete restrict,
  number            text not null
                    constraint sample_requests_number_format
                    check (number ~ '^SR-[0-9]{4}-[0-9]{4,}$'),
  supplier_id       uuid not null references public.suppliers (id) on delete restrict,
  product_id        uuid references public.products (id) on delete restrict,
  variant_id        uuid references public.product_variants (id) on delete restrict,
  description       text not null
                    constraint sample_requests_description_not_blank
                    check (length(trim(description)) > 0),
  quantity          integer not null default 1
                    constraint sample_requests_qty_positive
                    check (quantity > 0 and quantity <= 10000),
  purpose           text,
  status            text not null default 'requested'
                    constraint sample_requests_status_valid
                    check (status in ('requested', 'dispatched', 'received', 'evaluated', 'cancelled')),
  tracking_ref      text,
  dispatched_at     timestamptz,
  received_at       timestamptz,
  evaluated_at      timestamptz,
  evaluated_by      uuid references auth.users (id),
  evaluation_outcome text
                    constraint sample_requests_outcome_valid
                    check (evaluation_outcome is null or evaluation_outcome in ('approved', 'rejected')),
  evaluation_notes  text,
  cancel_reason     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id),
  updated_by        uuid references auth.users (id),
  unique (company_id, number),
  unique (id, company_id),
  constraint sample_requests_supplier_company_fkey
    foreign key (supplier_id, company_id)
    references public.suppliers (id, company_id) on delete restrict,
  constraint sample_requests_product_company_fkey
    foreign key (product_id, company_id)
    references public.products (id, company_id) on delete restrict
);

-- ---------------------------------------------------------------------
-- Documents (purchase orders and sample photos share one registry)
-- ---------------------------------------------------------------------
create table public.purchase_documents (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete restrict,
  entity_type text not null
              constraint purchase_documents_entity_valid
              check (entity_type in ('purchase_order', 'sample_request')),
  entity_id   uuid not null,
  file_id     uuid not null references public.file_metadata (id) on delete restrict,
  title       text,
  status      text not null default 'active'
              constraint purchase_documents_status_valid check (status in ('active', 'deleted')),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  unique (file_id)
);

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
create index approval_rules_company_idx on public.approval_rules (company_id, action);
create index approval_records_company_idx on public.approval_records (company_id);
create index approval_records_entity_idx on public.approval_records (entity_type, entity_id);
create index purchase_requests_company_idx on public.purchase_requests (company_id, status);
create index purchase_request_lines_request_idx on public.purchase_request_lines (request_id);
create index purchase_request_lines_company_idx on public.purchase_request_lines (company_id);
create index purchase_orders_company_idx on public.purchase_orders (company_id, status);
create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id);
create index purchase_orders_request_idx on public.purchase_orders (request_id);
create index purchase_order_lines_order_idx on public.purchase_order_lines (order_id);
create index purchase_order_lines_company_idx on public.purchase_order_lines (company_id);
create index purchase_order_line_costs_company_idx on public.purchase_order_line_costs (company_id);
create index purchase_receipts_order_idx on public.purchase_receipts (order_id);
create index purchase_receipts_company_idx on public.purchase_receipts (company_id);
create index purchase_receipt_lines_receipt_idx on public.purchase_receipt_lines (receipt_id);
create index purchase_receipt_lines_order_line_idx on public.purchase_receipt_lines (order_line_id);
create index sample_requests_company_idx on public.sample_requests (company_id, status);
create index sample_requests_supplier_idx on public.sample_requests (supplier_id);
create index purchase_documents_entity_idx on public.purchase_documents (entity_type, entity_id);
create index purchase_documents_company_idx on public.purchase_documents (company_id);

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
create trigger set_updated_at before update on public.approval_rules
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.purchase_requests
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.purchase_request_lines
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.purchase_orders
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.purchase_order_lines
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.purchase_order_line_costs
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.sample_requests
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------
-- Client writes are revoked everywhere: all writes go through audited
-- server services after a permission check.
-- ---------------------------------------------------------------------
revoke insert, update, delete, truncate on
  public.document_sequences, public.approval_rules, public.approval_records,
  public.purchase_requests, public.purchase_request_lines,
  public.purchase_orders, public.purchase_order_lines,
  public.purchase_order_line_costs, public.purchase_receipts,
  public.purchase_receipt_lines, public.sample_requests,
  public.purchase_documents
from anon, authenticated;

alter table public.document_sequences enable row level security;
alter table public.approval_rules enable row level security;
alter table public.approval_records enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.purchase_request_lines enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.purchase_order_line_costs enable row level security;
alter table public.purchase_receipts enable row level security;
alter table public.purchase_receipt_lines enable row level security;
alter table public.sample_requests enable row level security;
alter table public.purchase_documents enable row level security;

-- Sequences are an internal allocation detail: server-only, no policy.

create policy approval_rules_select on public.approval_rules
  for select to authenticated
  using (app.has_permission('purchasing.request.view', company_id));

create policy approval_records_select on public.approval_records
  for select to authenticated
  using (app.has_permission('purchasing.request.view', company_id));

create policy purchase_requests_select on public.purchase_requests
  for select to authenticated
  using (app.has_permission('purchasing.request.view', company_id));

create policy purchase_request_lines_select on public.purchase_request_lines
  for select to authenticated
  using (app.has_permission('purchasing.request.view', company_id));

create policy purchase_orders_select on public.purchase_orders
  for select to authenticated
  using (app.has_permission('purchasing.order.view', company_id));

create policy purchase_order_lines_select on public.purchase_order_lines
  for select to authenticated
  using (app.has_permission('purchasing.order.view', company_id));

-- Costs: deny-all. Prices are read only through the audited service
-- path (same rule as supplier_quotation_costs after 20260806130002).

create policy purchase_receipts_select on public.purchase_receipts
  for select to authenticated
  using (app.has_permission('purchasing.order.view', company_id));

create policy purchase_receipt_lines_select on public.purchase_receipt_lines
  for select to authenticated
  using (app.has_permission('purchasing.order.view', company_id));

create policy sample_requests_select on public.sample_requests
  for select to authenticated
  using (app.has_permission('purchasing.sample.view', company_id));

create policy purchase_documents_select on public.purchase_documents
  for select to authenticated
  using (app.has_permission('purchasing.document.download', company_id));
