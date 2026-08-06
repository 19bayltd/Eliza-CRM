-- Migration: Phase 03 permissions, role mappings, and document bucket
-- Purpose: supplier-module permission catalog, default role mappings
--          (owner may re-map), and the private supplier-documents bucket.
-- Rollback: delete the seeded role_permissions/permissions rows by key;
--           delete the bucket (only if empty).
-- Notes: idempotent (on conflict do nothing).

insert into storage.buckets (id, name, public) values
  ('supplier-documents', 'supplier-documents', false)
on conflict (id) do nothing;

insert into public.permissions (key, module, name, description) values
  ('suppliers.view',                 'suppliers', 'View suppliers',            'Read suppliers and contacts within granted scope'),
  ('suppliers.manage',               'suppliers', 'Manage suppliers',          'Create, edit, archive suppliers and contacts'),
  ('suppliers.quotation.view',       'suppliers', 'View quotations',           'See that quotations exist — terms, MOQ, lead time; never prices'),
  ('suppliers.quotation.cost.view',  'suppliers', 'View quotation costs',      'Read confidential quotation prices; every read is audited'),
  ('suppliers.quotation.manage',     'suppliers', 'Manage quotations',         'Create, edit, archive quotations (price writes also need cost view)'),
  ('suppliers.document.download',    'suppliers', 'Download supplier documents','Access private supplier documents; every download is audited'),
  ('suppliers.document.manage',      'suppliers', 'Manage supplier documents', 'Upload and remove private supplier documents')
on conflict (key) do nothing;

-- Owner: every permission (standing rule re-applied for new keys).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'owner'
on conflict do nothing;

-- Administrator: full supplier-module access.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in (
    'suppliers.view', 'suppliers.manage',
    'suppliers.quotation.view', 'suppliers.quotation.cost.view',
    'suppliers.quotation.manage',
    'suppliers.document.download', 'suppliers.document.manage'
  )
where r.key = 'administrator'
on conflict do nothing;

-- Manager: work with suppliers and see that quotes exist — no prices,
-- no documents (owner may widen via role administration later).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in ('suppliers.view', 'suppliers.manage', 'suppliers.quotation.view')
where r.key = 'manager'
on conflict do nothing;

-- Employee: read-only supplier directory. Viewer: no supplier access.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in ('suppliers.view')
where r.key = 'employee'
on conflict do nothing;
