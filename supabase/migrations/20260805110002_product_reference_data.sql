-- Migration: Phase 02 permissions, role mappings, and image buckets
-- Purpose: product-module permission catalog additions, default role
--          mappings (owner ratifies per ROLE_PERMISSION_MATRIX.md), and the
--          two product-image buckets (both PRIVATE; all object access via
--          server-issued signed URLs — the "public" tier is public *within
--          the company*, not on the open web; web exposure arrives with the
--          storefront/POS phases).
-- Rollback: delete the seeded role_permissions/permissions rows by key;
--           delete the two buckets (only if empty).
-- Notes: idempotent (on conflict do nothing).

insert into storage.buckets (id, name, public) values
  ('public-product-images', 'public-product-images', false),
  ('confidential-product-images', 'confidential-product-images', false)
on conflict (id) do nothing;

insert into public.permissions (key, module, name, description) values
  ('products.view',              'products', 'View products',              'Read products, variants, and catalog data within granted scope'),
  ('products.create',            'products', 'Create products',            'Create products and variants'),
  ('products.update',            'products', 'Update products',            'Edit products, variants, and their status'),
  ('products.archive',           'products', 'Archive products',           'Archive products and variants (no deletes)'),
  ('products.catalog.manage',    'products', 'Manage product catalog',     'Create, edit, archive categories, attributes, and units'),
  ('products.intelligence.view', 'products', 'View product intelligence',  'Read confidential sourcing and cost data; every read is audited'),
  ('products.import',            'products', 'Import products',            'Run validated CSV imports into the product master'),
  ('products.export',            'products', 'Export products',            'Export product data within granted scope')
on conflict (key) do nothing;

-- Owner: every permission (standing rule re-applied for the new keys).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'owner'
on conflict do nothing;

-- Administrator: full product-module access.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in (
    'products.view', 'products.create', 'products.update', 'products.archive',
    'products.catalog.manage', 'products.intelligence.view',
    'products.import', 'products.export'
  )
where r.key = 'administrator'
on conflict do nothing;

-- Manager: operate the catalog, no confidential costs, no import/export.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in (
    'products.view', 'products.create', 'products.update', 'products.archive',
    'products.catalog.manage'
  )
where r.key = 'manager'
on conflict do nothing;

-- Employee and Viewer: read-only product visibility.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in ('products.view')
where r.key in ('employee', 'viewer')
on conflict do nothing;
