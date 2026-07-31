-- Phase 01 RLS / cross-company isolation verification (STAGING ONLY).
-- Run each section separately against the staging database as an admin
-- connection. Executed 2026-07-31 with results recorded in
-- docs/phases/PHASE_01_SECURE_PLATFORM_FOUNDATION.md (Verification Evidence).
--
-- Section 1 — setup: synthetic users (empty password hash: can never sign in)
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-a@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"RLS Test A"}'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-b@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"RLS Test B"}')
on conflict (id) do nothing;

update public.user_profiles set account_status = 'active'
where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');

insert into public.user_company_scopes (user_id, company_id)
select '11111111-1111-4111-8111-111111111111', id from public.companies where code = 'ELIZA_SOURCE'
on conflict do nothing;
insert into public.user_company_scopes (user_id, company_id)
select '22222222-2222-4222-8222-222222222222', id from public.companies where code = '19BAY'
on conflict do nothing;

insert into public.user_roles (user_id, role_id, company_id)
select '11111111-1111-4111-8111-111111111111', r.id, c.id
from public.roles r, public.companies c
where r.key = 'administrator' and c.code = 'ELIZA_SOURCE'
on conflict do nothing;
insert into public.user_roles (user_id, role_id, company_id)
select '22222222-2222-4222-8222-222222222222', r.id, c.id
from public.roles r, public.companies c
where r.key = 'employee' and c.code = '19BAY'
on conflict do nothing;

-- Section 2 — probe as user A (administrator @ ELIZA_SOURCE).
-- EXPECT: companies_visible=1 (ELIZA_SOURCE only); every write DENIED:42501;
--         audit select DENIED:42501; profiles_visible=1 (own row only).
create or replace function pg_temp.try_sql(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return 'ALLOWED';
exception when others then
  return 'DENIED:' || sqlstate;
end;
$$;
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select
  (select count(*) from public.companies) as companies_visible,
  (select string_agg(code, ',') from public.companies) as company_codes,
  pg_temp.try_sql('select count(*) from public.audit_log') as audit_select,
  pg_temp.try_sql($q$insert into public.companies (code, name, base_currency) values ('HACK','Hack','USD')$q$) as company_insert,
  pg_temp.try_sql($q$update public.companies set name = 'tampered'$q$) as company_update,
  pg_temp.try_sql($q$insert into public.user_company_scopes (user_id, company_id) select '11111111-1111-4111-8111-111111111111', id from public.companies$q$) as scope_self_grant,
  (select count(*) from public.user_profiles) as profiles_visible;

-- Section 3 — probe as user B (employee @ 19BAY).
-- EXPECT: sees only 19BAY; company.view=true; branch.manage=false;
--         users.suspend=false; sees only own role/scope rows.
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select
  (select string_agg(code, ',') from public.companies) as b_company_codes,
  (select app.has_permission('organization.company.view', (select id from public.companies where code = '19BAY'))) as b_view_19bay,
  (select app.has_permission('organization.branch.manage', (select id from public.companies where code = '19BAY'))) as b_branch_manage_19bay,
  (select app.has_permission('users.suspend', (select id from public.companies where code = '19BAY'))) as b_users_suspend,
  (select count(*) from public.user_roles) as b_role_rows_visible,
  (select count(*) from public.user_company_scopes) as b_scope_rows_visible;

-- Section 4 — suspended-user gate.
-- EXPECT: 0 rows visible anywhere; is_active=false; has_permission=false.
update public.user_profiles set account_status = 'suspended'
where id = '22222222-2222-4222-8222-222222222222';
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select
  (select count(*) from public.companies) as suspended_companies_visible,
  (select app.is_active_user()) as suspended_is_active,
  (select app.has_permission('organization.company.view', (select c.id from public.companies c where c.code = '19BAY'))) as suspended_has_view,
  (select count(*) from public.roles) as suspended_roles_catalog_visible;

-- Section 5 — append-only audit check.
-- EXPECT: both PASS notices; selftest row remains.
do $$
declare v_id bigint;
begin
  insert into public.audit_log (module, action, entity_type, result)
  values ('audit', 'append_only_selftest', 'audit_log', 'success')
  returning id into v_id;
  begin
    update public.audit_log set reason = 'tamper' where id = v_id;
    raise exception 'FAIL: update was allowed';
  exception when others then
    if sqlerrm not like '%append-only%' then raise; end if;
    raise notice 'PASS: update blocked';
  end;
  begin
    delete from public.audit_log where id = v_id;
    raise exception 'FAIL: delete was allowed';
  exception when others then
    if sqlerrm not like '%append-only%' then raise; end if;
    raise notice 'PASS: delete blocked';
  end;
end $$;

-- Section 6 — cleanup (test users only; audit history is never deleted).
delete from auth.users where email like 'rls-test-%@example.com';
