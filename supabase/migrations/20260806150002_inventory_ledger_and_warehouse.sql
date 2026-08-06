-- Migration: inventory ledger and warehouse operations (Phase 05)
-- Purpose: the immutable stock ledger, its derived balances, warehouse
--          locations, transfers, approval-gated adjustments, counts, and
--          the evidence-document registry.
-- Rollback: drop, in order: stock_documents, stock_count_lines,
--           stock_counts, stock_adjustment_lines, stock_adjustments,
--           stock_transfer_lines, stock_transfers, stock_balances,
--           stock_ledger, warehouse_locations.
-- Notes: additive only. stock_ledger has no updated_at/updated_by/status
--        because nothing about a row may change — see 20260806150003 for
--        the triggers that enforce that and derive balances.

create table public.warehouse_locations (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  code         text not null
               constraint warehouse_locations_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  name         text not null constraint warehouse_locations_name_not_blank check (length(trim(name)) > 0),
  status       text not null default 'active'
               constraint warehouse_locations_status_valid check (status in ('active', 'archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id),
  updated_by   uuid references auth.users (id),
  unique (warehouse_id, code),
  unique (id, company_id),
  constraint warehouse_locations_warehouse_company_fkey
    foreign key (warehouse_id, company_id)
    references public.warehouses (id, company_id) on delete restrict
);

create table public.stock_ledger (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete restrict,
  warehouse_id     uuid not null references public.warehouses (id) on delete restrict,
  location_id      uuid references public.warehouse_locations (id) on delete restrict,
  product_id       uuid not null references public.products (id) on delete restrict,
  variant_id       uuid references public.product_variants (id) on delete restrict,
  txn_type         text not null
                   constraint stock_ledger_type_valid check (txn_type in (
                     'opening_stock', 'purchase_receipt', 'transfer_out', 'transfer_in',
                     'damage', 'adjustment', 'count_correction', 'supplier_return',
                     'sale', 'customer_return', 'reservation', 'reservation_release')),
  quantity         integer not null
                   constraint stock_ledger_quantity_nonzero check (quantity <> 0)
                   constraint stock_ledger_quantity_sane check (abs(quantity) <= 10000000),
  -- Sign is a property of the type: no code path can post a negative
  -- receipt or a positive damage.
  constraint stock_ledger_sign_matches_type check (
    (txn_type in ('opening_stock','purchase_receipt','transfer_in','customer_return','reservation_release') and quantity > 0)
    or (txn_type in ('transfer_out','damage','supplier_return','sale','reservation') and quantity < 0)
    or (txn_type in ('adjustment','count_correction'))
  ),
  reference_type   text,
  reference_id     uuid,
  reference_number text,
  reason           text,
  occurred_at      timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id),
  constraint stock_ledger_product_company_fkey
    foreign key (product_id, company_id)
    references public.products (id, company_id) on delete restrict,
  constraint stock_ledger_warehouse_company_fkey
    foreign key (warehouse_id, company_id)
    references public.warehouses (id, company_id) on delete restrict,
  constraint stock_ledger_location_company_fkey
    foreign key (location_id, company_id)
    references public.warehouse_locations (id, company_id) on delete restrict
);

-- Written ONLY by the ledger trigger (20260806150003).
create table public.stock_balances (
  company_id   uuid not null references public.companies (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  product_id   uuid not null references public.products (id) on delete restrict,
  variant_id   uuid references public.product_variants (id) on delete restrict,
  quantity     integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (warehouse_id, product_id, variant_id)
);

create table public.stock_transfers (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete restrict,
  number         text not null
                 constraint stock_transfers_number_format check (number ~ '^TRF-[0-9]{4}-[0-9]{4,}$'),
  from_warehouse uuid not null references public.warehouses (id) on delete restrict,
  to_warehouse   uuid not null references public.warehouses (id) on delete restrict,
  status         text not null default 'draft'
                 constraint stock_transfers_status_valid
                 check (status in ('draft', 'dispatched', 'received', 'cancelled')),
  note           text,
  dispatched_at  timestamptz,
  dispatched_by  uuid references auth.users (id),
  received_at    timestamptz,
  received_by    uuid references auth.users (id),
  cancel_reason  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id),
  updated_by     uuid references auth.users (id),
  unique (company_id, number),
  unique (id, company_id),
  constraint stock_transfers_distinct_warehouses check (from_warehouse <> to_warehouse),
  constraint stock_transfers_from_company_fkey
    foreign key (from_warehouse, company_id)
    references public.warehouses (id, company_id) on delete restrict,
  constraint stock_transfers_to_company_fkey
    foreign key (to_warehouse, company_id)
    references public.warehouses (id, company_id) on delete restrict
);

create table public.stock_transfer_lines (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete restrict,
  transfer_id   uuid not null references public.stock_transfers (id) on delete restrict,
  product_id    uuid not null references public.products (id) on delete restrict,
  variant_id    uuid references public.product_variants (id) on delete restrict,
  quantity      integer not null
                constraint stock_transfer_lines_qty_positive check (quantity > 0 and quantity <= 1000000),
  received_qty  integer not null default 0
                constraint stock_transfer_lines_received_sane check (received_qty >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id),
  updated_by    uuid references auth.users (id),
  constraint stock_transfer_lines_received_not_over check (received_qty <= quantity),
  constraint stock_transfer_lines_transfer_company_fkey
    foreign key (transfer_id, company_id)
    references public.stock_transfers (id, company_id) on delete restrict,
  constraint stock_transfer_lines_product_company_fkey
    foreign key (product_id, company_id)
    references public.products (id, company_id) on delete restrict
);

create table public.stock_adjustments (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete restrict,
  number          text not null
                  constraint stock_adjustments_number_format check (number ~ '^ADJ-[0-9]{4}-[0-9]{4,}$'),
  warehouse_id    uuid not null references public.warehouses (id) on delete restrict,
  reason          text not null
                  constraint stock_adjustments_reason_not_blank check (length(trim(reason)) >= 3),
  status          text not null default 'draft'
                  constraint stock_adjustments_status_valid
                  check (status in ('draft', 'submitted', 'approved', 'rejected', 'cancelled')),
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
  unique (id, company_id),
  constraint stock_adjustments_warehouse_company_fkey
    foreign key (warehouse_id, company_id)
    references public.warehouses (id, company_id) on delete restrict
);

create table public.stock_adjustment_lines (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete restrict,
  adjustment_id uuid not null references public.stock_adjustments (id) on delete restrict,
  product_id    uuid not null references public.products (id) on delete restrict,
  variant_id    uuid references public.product_variants (id) on delete restrict,
  quantity      integer not null
                constraint stock_adjustment_lines_qty_nonzero check (quantity <> 0 and abs(quantity) <= 1000000),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id),
  updated_by    uuid references auth.users (id),
  constraint stock_adjustment_lines_adjustment_company_fkey
    foreign key (adjustment_id, company_id)
    references public.stock_adjustments (id, company_id) on delete restrict,
  constraint stock_adjustment_lines_product_company_fkey
    foreign key (product_id, company_id)
    references public.products (id, company_id) on delete restrict
);

create table public.stock_counts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete restrict,
  number        text not null
                constraint stock_counts_number_format check (number ~ '^CNT-[0-9]{4}-[0-9]{4,}$'),
  warehouse_id  uuid not null references public.warehouses (id) on delete restrict,
  status        text not null default 'counting'
                constraint stock_counts_status_valid
                check (status in ('counting', 'posted', 'cancelled')),
  note          text,
  posted_at     timestamptz,
  posted_by     uuid references auth.users (id),
  cancel_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id),
  updated_by    uuid references auth.users (id),
  unique (company_id, number),
  unique (id, company_id),
  constraint stock_counts_warehouse_company_fkey
    foreign key (warehouse_id, company_id)
    references public.warehouses (id, company_id) on delete restrict
);

create table public.stock_count_lines (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete restrict,
  count_id    uuid not null references public.stock_counts (id) on delete restrict,
  product_id  uuid not null references public.products (id) on delete restrict,
  variant_id  uuid references public.product_variants (id) on delete restrict,
  -- Snapshot taken when the count opened, so variance is measured
  -- against what the system believed at that moment.
  system_qty  integer not null,
  counted_qty integer
              constraint stock_count_lines_counted_sane
              check (counted_qty is null or (counted_qty >= 0 and counted_qty <= 10000000)),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  updated_by  uuid references auth.users (id),
  constraint stock_count_lines_count_company_fkey
    foreign key (count_id, company_id)
    references public.stock_counts (id, company_id) on delete restrict,
  constraint stock_count_lines_product_company_fkey
    foreign key (product_id, company_id)
    references public.products (id, company_id) on delete restrict
);

create table public.stock_documents (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete restrict,
  entity_type text not null
              constraint stock_documents_entity_valid
              check (entity_type in ('stock_count', 'stock_adjustment')),
  entity_id   uuid not null,
  file_id     uuid not null references public.file_metadata (id) on delete restrict,
  title       text,
  status      text not null default 'active'
              constraint stock_documents_status_valid check (status in ('active', 'deleted')),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  unique (file_id)
);

create index stock_ledger_company_idx on public.stock_ledger (company_id, occurred_at desc);
create index stock_ledger_balance_key_idx on public.stock_ledger (warehouse_id, product_id, variant_id);
create index stock_ledger_reference_idx on public.stock_ledger (reference_type, reference_id);
create index stock_balances_company_idx on public.stock_balances (company_id);
create index stock_balances_product_idx on public.stock_balances (product_id);
create index warehouse_locations_company_idx on public.warehouse_locations (company_id);
create index stock_transfers_company_idx on public.stock_transfers (company_id, status);
create index stock_transfer_lines_transfer_idx on public.stock_transfer_lines (transfer_id);
create index stock_adjustments_company_idx on public.stock_adjustments (company_id, status);
create index stock_adjustment_lines_adjustment_idx on public.stock_adjustment_lines (adjustment_id);
create index stock_counts_company_idx on public.stock_counts (company_id, status);
create index stock_count_lines_count_idx on public.stock_count_lines (count_id);
create index stock_documents_entity_idx on public.stock_documents (entity_type, entity_id);

create trigger set_updated_at before update on public.warehouse_locations
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.stock_transfers
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.stock_transfer_lines
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.stock_adjustments
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.stock_adjustment_lines
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.stock_counts
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.stock_count_lines
  for each row execute function app.set_updated_at();
