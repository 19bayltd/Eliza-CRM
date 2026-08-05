-- Migration: product master (Phase 02)
-- Purpose: products, variants, categories, attributes, units, confidential
--          product intelligence, product image registry, and the CSV import
--          job ledger — the single product source of truth per company.
-- Rollback: drop tables import_job_rows, import_jobs, product_images,
--           product_intelligence, variant_attribute_values, product_variants,
--           products, attribute_values, attributes, categories, units.
-- Notes: additive only. Archive-only lifecycle everywhere (no deletes).
--        Writes are server-side only (service role after permission checks);
--        clients get scoped reads via RLS. Money is numeric, never float.

-- ---------------------------------------------------------------- units
create table public.units (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  code       text not null
             constraint units_code_format check (code ~ '^[A-Z0-9][A-Z0-9_]*$'),
  name       text not null constraint units_name_not_blank check (length(trim(name)) > 0),
  status     text not null default 'active'
             constraint units_status_valid check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (company_id, code)
);

-- ----------------------------------------------------------- categories
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  parent_id  uuid references public.categories (id) on delete restrict,
  code       text not null
             constraint categories_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  name       text not null constraint categories_name_not_blank check (length(trim(name)) > 0),
  status     text not null default 'active'
             constraint categories_status_valid check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (company_id, code),
  constraint categories_not_own_parent check (parent_id is distinct from id)
);

-- ----------------------------------------------------------- attributes
create table public.attributes (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  code       text not null
             constraint attributes_code_format check (code ~ '^[A-Z0-9][A-Z0-9_]*$'),
  name       text not null constraint attributes_name_not_blank check (length(trim(name)) > 0),
  status     text not null default 'active'
             constraint attributes_status_valid check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (company_id, code)
);

create table public.attribute_values (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete restrict,
  attribute_id uuid not null references public.attributes (id) on delete restrict,
  value        text not null
               constraint attribute_values_not_blank check (length(trim(value)) > 0),
  position     integer not null default 0,
  status       text not null default 'active'
               constraint attribute_values_status_valid check (status in ('active', 'archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id),
  updated_by   uuid references auth.users (id),
  unique (attribute_id, value)
);

-- ------------------------------------------------------------- products
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete restrict,
  sku         text not null
              constraint products_sku_format check (sku ~ '^[A-Z0-9][A-Z0-9-]*$'),
  name        text not null constraint products_name_not_blank check (length(trim(name)) > 0),
  description text,
  category_id uuid references public.categories (id) on delete restrict,
  unit_id     uuid references public.units (id) on delete restrict,
  status      text not null default 'draft'
              constraint products_status_valid check (status in ('draft', 'active', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  updated_by  uuid references auth.users (id),
  unique (company_id, sku)
);

create table public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  sku        text not null
             constraint product_variants_sku_format check (sku ~ '^[A-Z0-9][A-Z0-9-]*$'),
  status     text not null default 'draft'
             constraint product_variants_status_valid check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (company_id, sku)
);

-- One value per attribute per variant; combination uniqueness across a
-- product's variants is enforced by the product service (requires
-- comparing full attribute sets, which SQL constraints cannot express).
create table public.variant_attribute_values (
  variant_id         uuid not null references public.product_variants (id) on delete cascade,
  attribute_id       uuid not null references public.attributes (id) on delete restrict,
  attribute_value_id uuid not null references public.attribute_values (id) on delete restrict,
  company_id         uuid not null references public.companies (id) on delete restrict,
  created_at         timestamptz not null default now(),
  primary key (variant_id, attribute_id)
);

-- ------------------------------------------- confidential intelligence
-- Confidential classification: separate table so RLS can wall it off
-- entirely from users without products.intelligence.view.
create table public.product_intelligence (
  product_id           uuid primary key references public.products (id) on delete restrict,
  company_id           uuid not null references public.companies (id) on delete restrict,
  sourcing_notes       text,
  target_cost          numeric(14, 2)
                       constraint product_intelligence_cost_positive
                       check (target_cost is null or target_cost >= 0),
  target_cost_currency char(3)
                       constraint product_intelligence_currency_format
                       check (target_cost_currency is null or target_cost_currency ~ '^[A-Z]{3}$'),
  remarks              text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid references auth.users (id),
  updated_by           uuid references auth.users (id)
);

-- ------------------------------------------------------ product images
-- Registry rows point at file_metadata; the objects live in the two
-- product-image buckets (both private; access via signed URLs only).
create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  variant_id uuid references public.product_variants (id) on delete restrict,
  file_id    uuid not null references public.file_metadata (id) on delete restrict,
  tier       text not null
             constraint product_images_tier_valid check (tier in ('public', 'confidential')),
  position   integer not null default 0,
  status     text not null default 'active'
             constraint product_images_status_valid check (status in ('active', 'deleted')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  unique (file_id)
);

-- --------------------------------------------------------- CSV imports
create table public.import_jobs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete restrict,
  module       text not null default 'products',
  filename     text not null,
  status       text not null default 'validated'
               constraint import_jobs_status_valid
               check (status in ('validated', 'applied', 'discarded')),
  rows_total   integer not null default 0,
  rows_create  integer not null default 0,
  rows_update  integer not null default 0,
  rows_reject  integer not null default 0,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id),
  applied_at   timestamptz,
  applied_by   uuid references auth.users (id)
);

create table public.import_job_rows (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.import_jobs (id) on delete cascade,
  company_id     uuid not null references public.companies (id) on delete restrict,
  row_number     integer not null,
  raw            jsonb not null,
  planned_action text not null
                 constraint import_job_rows_action_valid
                 check (planned_action in ('create_product', 'create_variant', 'update_product', 'reject')),
  message        text,
  applied        boolean not null default false,
  unique (job_id, row_number)
);

-- -------------------------------------------------------------- indexes
create index units_company_idx on public.units (company_id);
create index categories_company_idx on public.categories (company_id);
create index categories_parent_idx on public.categories (parent_id);
create index attributes_company_idx on public.attributes (company_id);
create index attribute_values_company_idx on public.attribute_values (company_id);
create index attribute_values_attribute_idx on public.attribute_values (attribute_id);
create index products_company_idx on public.products (company_id);
create index products_category_idx on public.products (category_id);
create index products_unit_idx on public.products (unit_id);
create index products_status_idx on public.products (company_id, status);
create index product_variants_company_idx on public.product_variants (company_id);
create index product_variants_product_idx on public.product_variants (product_id);
create index variant_attribute_values_company_idx on public.variant_attribute_values (company_id);
create index variant_attribute_values_value_idx on public.variant_attribute_values (attribute_value_id);
create index product_intelligence_company_idx on public.product_intelligence (company_id);
create index product_images_company_idx on public.product_images (company_id);
create index product_images_product_idx on public.product_images (product_id);
create index product_images_variant_idx on public.product_images (variant_id);
create index import_jobs_company_idx on public.import_jobs (company_id);
create index import_job_rows_job_idx on public.import_job_rows (job_id);
create index import_job_rows_company_idx on public.import_job_rows (company_id);

-- ------------------------------------------------------------- triggers
create trigger set_updated_at before update on public.units
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.categories
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.attributes
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.attribute_values
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.products
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.product_variants
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.product_intelligence
  for each row execute function app.set_updated_at();

-- ------------------------------------------------- write-path lockdown
-- All writes go through server services (service role) after the full
-- permission check; clients never write product tables directly.
revoke insert, update, delete, truncate on
  public.units, public.categories, public.attributes, public.attribute_values,
  public.products, public.product_variants, public.variant_attribute_values,
  public.product_intelligence, public.product_images,
  public.import_jobs, public.import_job_rows
from anon, authenticated;

-- ------------------------------------------------------------------ RLS
alter table public.units enable row level security;
alter table public.categories enable row level security;
alter table public.attributes enable row level security;
alter table public.attribute_values enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.variant_attribute_values enable row level security;
alter table public.product_intelligence enable row level security;
alter table public.product_images enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_job_rows enable row level security;

-- Catalog + products: read within granted company scope.
create policy units_select on public.units
  for select to authenticated
  using (app.has_company_access(company_id));

create policy categories_select on public.categories
  for select to authenticated
  using (app.has_company_access(company_id));

create policy attributes_select on public.attributes
  for select to authenticated
  using (app.has_company_access(company_id));

create policy attribute_values_select on public.attribute_values
  for select to authenticated
  using (app.has_company_access(company_id));

create policy products_select on public.products
  for select to authenticated
  using (app.has_company_access(company_id));

create policy product_variants_select on public.product_variants
  for select to authenticated
  using (app.has_company_access(company_id));

create policy variant_attribute_values_select on public.variant_attribute_values
  for select to authenticated
  using (app.has_company_access(company_id));

-- Confidential intelligence: company scope alone is NOT enough — the
-- caller must hold products.intelligence.view in that company.
create policy product_intelligence_select on public.product_intelligence
  for select to authenticated
  using (app.has_permission('products.intelligence.view', company_id));

-- Images: public tier within company scope; confidential tier requires
-- the intelligence permission.
create policy product_images_select on public.product_images
  for select to authenticated
  using (
    case tier
      when 'public' then app.has_company_access(company_id)
      else app.has_permission('products.intelligence.view', company_id)
    end
  );

-- Import ledger: restricted to import-permission holders.
create policy import_jobs_select on public.import_jobs
  for select to authenticated
  using (app.has_permission('products.import', company_id));

create policy import_job_rows_select on public.import_job_rows
  for select to authenticated
  using (app.has_permission('products.import', company_id));
