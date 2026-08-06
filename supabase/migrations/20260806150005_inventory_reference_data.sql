-- Migration: Phase 05 permissions, role mappings, bucket, approval rule
-- Purpose: inventory permission catalog, default role mappings (owner may
--          re-map), the stock-documents bucket, and the seeded adjustment
--          approval tier.
-- Rollback: delete the seeded role_permissions/permissions rows by key;
--           delete approval_rules rows for 'stock_adjustment.approve';
--           delete the bucket (only if empty).
-- Notes: idempotent (on conflict do nothing). Viewer receives read access
--        here — the first module where that role is granted anything,
--        because stock quantities are Internal, not Confidential.

insert into storage.buckets (id, name, public) values
  ('stock-documents', 'stock-documents', false)
on conflict (id) do nothing;

insert into public.permissions (key, module, name, description) values
  ('inventory.view',                'inventory', 'View stock',              'See balances, ledger history, transfers, adjustments and counts'),
  ('inventory.movement.post',       'inventory', 'Post stock movements',    'Opening stock, damage, supplier returns'),
  ('inventory.transfer.manage',     'inventory', 'Manage transfers',        'Create, dispatch and cancel warehouse transfers'),
  ('inventory.transfer.receive',    'inventory', 'Receive transfers',       'Receive stock arriving from another warehouse'),
  ('inventory.adjustment.manage',   'inventory', 'Raise adjustments',       'Create and submit stock adjustments for approval'),
  ('inventory.adjustment.approve',  'inventory', 'Approve adjustments',     'Approve or reject adjustments; approval posts them to the ledger'),
  ('inventory.count.manage',        'inventory', 'Manage stock counts',     'Open, enter and post physical stock counts'),
  ('inventory.negative.override',   'inventory', 'Override negative stock', 'Post a movement that drives a balance below zero; every use is audited'),
  ('inventory.location.manage',     'inventory', 'Manage locations',        'Create and archive locations within a warehouse'),
  ('inventory.document.download',   'inventory', 'Download stock files',    'Count sheets and evidence; downloads audited'),
  ('inventory.document.manage',     'inventory', 'Manage stock files',      'Upload and remove count sheets and evidence')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'owner' on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in ('inventory.view','inventory.movement.post','inventory.transfer.manage',
               'inventory.transfer.receive','inventory.adjustment.manage','inventory.adjustment.approve',
               'inventory.count.manage','inventory.negative.override','inventory.location.manage',
               'inventory.document.download','inventory.document.manage')
where r.key = 'administrator' on conflict do nothing;

-- Manager moves stock but cannot approve adjustments or override the
-- negative-stock block: those change stock by decree.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in ('inventory.view','inventory.movement.post','inventory.transfer.manage',
               'inventory.transfer.receive','inventory.adjustment.manage',
               'inventory.count.manage','inventory.location.manage',
               'inventory.document.download','inventory.document.manage')
where r.key = 'manager' on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in ('inventory.view','inventory.document.download')
where r.key = 'employee' on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in ('inventory.view')
where r.key = 'viewer' on conflict do nothing;

-- Adjustment approval reuses the Phase 04 engine. One tier by default;
-- the owner can add value tiers later without a deployment.
insert into public.approval_rules (company_id, action, min_amount, required_permission)
select c.id, 'stock_adjustment.approve', 0, 'inventory.adjustment.approve'
from public.companies c
on conflict (company_id, action, min_amount) do nothing;
