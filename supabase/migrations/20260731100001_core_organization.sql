-- Migration: core organization structure
-- Purpose: companies, branches, warehouses, departments — the multi-company
--          backbone every other module scopes against.
-- Rollback: drop tables departments, warehouses, branches, companies;
--           drop function app.set_updated_at; drop schema app.
-- Notes: additive only; deterministic; no data dependencies.

create schema if not exists app;

-- Shared updated_at maintenance
create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique
                constraint companies_code_format check (code ~ '^[A-Z0-9][A-Z0-9_]*$'),
  name          text not null constraint companies_name_not_blank check (length(trim(name)) > 0),
  base_currency char(3) not null
                constraint companies_currency_format check (base_currency ~ '^[A-Z]{3}$'),
  timezone      text not null default 'Asia/Dhaka',
  status        text not null default 'active'
                constraint companies_status_valid check (status in ('active', 'archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id),
  updated_by    uuid references auth.users (id)
);

create table public.branches (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  code       text not null
             constraint branches_code_format check (code ~ '^[A-Z0-9][A-Z0-9_]*$'),
  name       text not null constraint branches_name_not_blank check (length(trim(name)) > 0),
  status     text not null default 'active'
             constraint branches_status_valid check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (company_id, code)
);

create table public.warehouses (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  branch_id  uuid references public.branches (id) on delete restrict,
  code       text not null
             constraint warehouses_code_format check (code ~ '^[A-Z0-9][A-Z0-9_]*$'),
  name       text not null constraint warehouses_name_not_blank check (length(trim(name)) > 0),
  status     text not null default 'active'
             constraint warehouses_status_valid check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (company_id, code)
);

create table public.departments (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  branch_id  uuid references public.branches (id) on delete restrict,
  code       text not null
             constraint departments_code_format check (code ~ '^[A-Z0-9][A-Z0-9_]*$'),
  name       text not null constraint departments_name_not_blank check (length(trim(name)) > 0),
  status     text not null default 'active'
             constraint departments_status_valid check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (company_id, code)
);

create index branches_company_idx on public.branches (company_id);
create index warehouses_company_idx on public.warehouses (company_id);
create index warehouses_branch_idx on public.warehouses (branch_id);
create index departments_company_idx on public.departments (company_id);
create index departments_branch_idx on public.departments (branch_id);

create trigger set_updated_at before update on public.companies
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.branches
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.warehouses
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.departments
  for each row execute function app.set_updated_at();

-- Writes to organization tables are privileged: server-side only via the
-- service role after permission checks. Clients get read via RLS only.
revoke insert, update, delete, truncate on
  public.companies, public.branches, public.warehouses, public.departments
from anon, authenticated;
