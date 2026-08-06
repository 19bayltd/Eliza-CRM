-- Migration: Phase 04 permissions, role mappings, buckets, approval rules
-- Purpose: purchasing permission catalog, default role mappings (owner may
--          re-map), the two storage buckets, and the seeded approval
--          thresholds for every existing company.
-- Rollback: delete the seeded role_permissions/permissions rows by key;
--           delete approval_rules rows for action 'purchase_request.approve';
--           delete the buckets (only if empty).
-- Notes: idempotent (on conflict do nothing).

insert into storage.buckets (id, name, public) values
  ('purchase-documents', 'purchase-documents', false),
  ('sample-photos', 'sample-photos', false)
on conflict (id) do nothing;

insert into public.permissions (key, module, name, description) values
  ('purchasing.request.view',         'purchasing', 'View purchase requests',   'Read purchase requests and their lines'),
  ('purchasing.request.manage',       'purchasing', 'Manage purchase requests', 'Create, edit, submit and cancel requests'),
  ('purchasing.request.approve',      'purchasing', 'Approve requests',         'Approve or reject requests below the high threshold'),
  ('purchasing.request.approve.high', 'purchasing', 'Approve high-value requests', 'Approve or reject requests at or above the high threshold'),
  ('purchasing.order.view',           'purchasing', 'View purchase orders',     'See orders, lines, quantities and statuses — never prices'),
  ('purchasing.order.manage',         'purchasing', 'Manage purchase orders',   'Create, issue and cancel purchase orders'),
  ('purchasing.cost.view',            'purchasing', 'View order costs',         'Read confidential order prices and totals; every read is audited'),
  ('purchasing.receive',              'purchasing', 'Receive goods',            'Record receipts against issued purchase orders'),
  ('purchasing.sample.view',          'purchasing', 'View samples',             'Read sample requests and evaluations'),
  ('purchasing.sample.manage',        'purchasing', 'Manage samples',           'Raise, dispatch, receive and evaluate samples'),
  ('purchasing.document.download',    'purchasing', 'Download purchase files',  'Access purchase documents and sample photos; downloads audited'),
  ('purchasing.document.manage',      'purchasing', 'Manage purchase files',    'Upload and remove purchase documents and sample photos')
on conflict (key) do nothing;

-- Owner: every permission (standing rule re-applied for new keys).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'owner'
on conflict do nothing;

-- Administrator: full purchasing access, including costs and high-value
-- approval.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in (
    'purchasing.request.view', 'purchasing.request.manage',
    'purchasing.request.approve', 'purchasing.request.approve.high',
    'purchasing.order.view', 'purchasing.order.manage',
    'purchasing.cost.view', 'purchasing.receive',
    'purchasing.sample.view', 'purchasing.sample.manage',
    'purchasing.document.download', 'purchasing.document.manage'
  )
where r.key = 'administrator'
on conflict do nothing;

-- Manager: runs day-to-day purchasing — requests, ordinary approvals,
-- receiving, samples, documents — but never sees order prices and cannot
-- issue orders or approve high-value spend.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in (
    'purchasing.request.view', 'purchasing.request.manage',
    'purchasing.request.approve',
    'purchasing.order.view', 'purchasing.receive',
    'purchasing.sample.view', 'purchasing.sample.manage',
    'purchasing.document.download', 'purchasing.document.manage'
  )
where r.key = 'manager'
on conflict do nothing;

-- Employee: may ask, not commit.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in (
    'purchasing.request.view', 'purchasing.request.manage',
    'purchasing.sample.view'
  )
where r.key = 'employee'
on conflict do nothing;

-- Viewer: no purchasing access.

-- Default approval thresholds per company (D-021). These are data: the
-- owner can change the amount, add tiers, or point a tier at a different
-- permission without a deployment.
insert into public.approval_rules (company_id, action, min_amount, required_permission)
select c.id, 'purchase_request.approve', 0, 'purchasing.request.approve'
from public.companies c
on conflict (company_id, action, min_amount) do nothing;

insert into public.approval_rules (company_id, action, min_amount, required_permission)
select c.id, 'purchase_request.approve', 500000, 'purchasing.request.approve.high'
from public.companies c
on conflict (company_id, action, min_amount) do nothing;
