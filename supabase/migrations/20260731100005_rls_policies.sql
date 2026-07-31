-- Migration: RLS helpers and policies
-- Purpose: database-boundary enforcement of account status, company scope,
--          and permission checks. RLS is the second enforcement layer —
--          the server layer performs the full 12-point check first, and
--          privileged administrative writes never rely on RLS alone.
-- Rollback: drop the policies, disable RLS on the listed tables, drop the
--           three app.* helper functions.
-- Notes: helper functions are SECURITY DEFINER so policies can consult
--        identity tables without recursive RLS evaluation; they are STABLE
--        and take an explicit search_path.

-- Only users whose profile is 'active' pass any data-access check.
create or replace function app.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'active'
  );
$$;

-- Explicit company scope, active users only.
create or replace function app.has_company_access(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_active_user()
     and exists (
       select 1
       from public.user_company_scopes s
       where s.user_id = (select auth.uid())
         and s.company_id = target_company_id
     );
$$;

-- Permission via any assigned role that is either global (company_id null)
-- or scoped to the target company; company scope is always required too.
create or replace function app.has_permission(perm_key text, target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_company_access(target_company_id)
     and exists (
       select 1
       from public.user_roles ur
       join public.role_permissions rp on rp.role_id = ur.role_id
       join public.permissions perm on perm.id = rp.permission_id
       where ur.user_id = (select auth.uid())
         and perm.key = perm_key
         and (ur.company_id is null or ur.company_id = target_company_id)
     );
$$;

revoke all on function app.is_active_user() from public;
revoke all on function app.has_company_access(uuid) from public;
revoke all on function app.has_permission(text, uuid) from public;
grant execute on function app.is_active_user() to authenticated;
grant execute on function app.has_company_access(uuid) to authenticated;
grant execute on function app.has_permission(text, uuid) to authenticated;

-- Enable RLS everywhere. Tables with no policy for a command deny it.
alter table public.companies enable row level security;
alter table public.branches enable row level security;
alter table public.warehouses enable row level security;
alter table public.departments enable row level security;
alter table public.user_profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_company_scopes enable row level security;
alter table public.user_branch_scopes enable row level security;
alter table public.user_warehouse_scopes enable row level security;
alter table public.user_department_scopes enable row level security;
alter table public.audit_log enable row level security;
alter table public.file_metadata enable row level security;

-- Organization: read within granted company scope only.
create policy companies_select on public.companies
  for select to authenticated
  using (app.has_company_access(id));

create policy branches_select on public.branches
  for select to authenticated
  using (app.has_company_access(company_id));

create policy warehouses_select on public.warehouses
  for select to authenticated
  using (app.has_company_access(company_id));

create policy departments_select on public.departments
  for select to authenticated
  using (app.has_company_access(company_id));

-- Identity: users see their own profile/assignments; administration reads
-- happen server-side with explicit permission checks.
create policy user_profiles_select_own on public.user_profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy roles_select on public.roles
  for select to authenticated
  using (app.is_active_user());

create policy permissions_select on public.permissions
  for select to authenticated
  using (app.is_active_user());

create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (app.is_active_user());

create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_company_scopes_select_own on public.user_company_scopes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_branch_scopes_select_own on public.user_branch_scopes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_warehouse_scopes_select_own on public.user_warehouse_scopes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_department_scopes_select_own on public.user_department_scopes
  for select to authenticated
  using (user_id = (select auth.uid()));

-- audit_log: intentionally NO policies — all client access denied.
-- file_metadata: read within company scope; writes are server-only.
create policy file_metadata_select on public.file_metadata
  for select to authenticated
  using (app.has_company_access(company_id));
