-- Migration: identity and access
-- Purpose: user profiles with account states, roles, permissions,
--          role-permission and user-role assignments, and explicit
--          organizational scope grants (company/branch/warehouse/department).
-- Rollback: drop scope tables, user_roles, role_permissions, permissions,
--           roles, user_profiles; drop trigger on auth.users; drop
--           function app.handle_new_user; drop type public.account_status.
-- Notes: additive only. Authorization is permission-based; role names are
--        never checked directly in application logic.

create type public.account_status as enum
  ('invited', 'active', 'suspended', 'locked', 'disabled', 'exited');

create table public.user_profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null unique,
  full_name      text not null default '',
  account_status public.account_status not null default 'invited',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id),
  updated_by     uuid references auth.users (id)
);

create trigger set_updated_at before update on public.user_profiles
  for each row execute function app.set_updated_at();

-- Keep a profile row for every auth user, created at invitation time.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, email, full_name, account_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'invited'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique
              constraint roles_key_format check (key ~ '^[a-z][a-z0-9_]*$'),
  name        text not null,
  description text not null default '',
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger set_updated_at before update on public.roles
  for each row execute function app.set_updated_at();

create table public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique
              constraint permissions_key_format check (key ~ '^[a-z][a-z0-9_.]*$'),
  module      text not null,
  name        text not null,
  description text not null default '',
  created_at  timestamptz not null default now()
);

create table public.role_permissions (
  role_id       uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (role_id, permission_id)
);

-- Role assignment. company_id NULL means the role applies in every company
-- the user holds a company scope for (used for Owner/global Administrator);
-- such global grants are explicit rows and are audited like any other.
create table public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.user_profiles (id) on delete cascade,
  role_id    uuid not null references public.roles (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  unique nulls not distinct (user_id, role_id, company_id)
);

create index user_roles_user_idx on public.user_roles (user_id);

-- Explicit organizational scope grants. Access is never implied.
create table public.user_company_scopes (
  user_id    uuid not null references public.user_profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  primary key (user_id, company_id)
);

create table public.user_branch_scopes (
  user_id    uuid not null references public.user_profiles (id) on delete cascade,
  branch_id  uuid not null references public.branches (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  primary key (user_id, branch_id)
);

create table public.user_warehouse_scopes (
  user_id      uuid not null references public.user_profiles (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id),
  primary key (user_id, warehouse_id)
);

create table public.user_department_scopes (
  user_id       uuid not null references public.user_profiles (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id),
  primary key (user_id, department_id)
);

create index user_company_scopes_company_idx on public.user_company_scopes (company_id);
create index user_branch_scopes_branch_idx on public.user_branch_scopes (branch_id);
create index user_warehouse_scopes_warehouse_idx on public.user_warehouse_scopes (warehouse_id);
create index user_department_scopes_department_idx on public.user_department_scopes (department_id);

-- All identity/access writes are privileged server-side operations.
revoke insert, update, delete, truncate on
  public.user_profiles, public.roles, public.permissions,
  public.role_permissions, public.user_roles, public.user_company_scopes,
  public.user_branch_scopes, public.user_warehouse_scopes,
  public.user_department_scopes
from anon, authenticated;
