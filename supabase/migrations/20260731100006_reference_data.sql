-- Migration: permission catalog and role templates (reference data)
-- Purpose: Phase 01 permission set and the five approved role templates
--          (Owner, Administrator, Manager, Employee, Viewer).
-- Rollback: delete the seeded role_permissions, roles, and permissions rows
--           by key (no application data references them until users are
--           assigned).
-- Notes: idempotent (on conflict do nothing). Authorization always checks
--        permissions + scopes, never role names.

insert into public.permissions (key, module, name, description) values
  ('organization.company.view',    'organization', 'View companies',        'Read companies within granted scope'),
  ('organization.company.create',  'organization', 'Create companies',      'Create a new company'),
  ('organization.company.update',  'organization', 'Update companies',      'Edit company details'),
  ('organization.company.archive', 'organization', 'Archive companies',     'Archive a company (no deletes)'),
  ('organization.branch.manage',   'organization', 'Manage branches',       'Create, edit, archive branches'),
  ('organization.warehouse.manage','organization', 'Manage warehouses',     'Create, edit, archive warehouses'),
  ('organization.department.manage','organization','Manage departments',    'Create, edit, archive departments'),
  ('users.view',                   'users',        'View users',            'List users and their assignments'),
  ('users.invite',                 'users',        'Invite users',          'Send account invitations'),
  ('users.update',                 'users',        'Update users',          'Edit user profile details'),
  ('users.suspend',                'users',        'Suspend users',         'Suspend, reinstate, disable accounts'),
  ('users.role.assign',            'users',        'Assign roles',          'Grant and revoke role assignments'),
  ('users.scope.assign',           'users',        'Assign scopes',         'Grant and revoke org scope access'),
  ('audit.log.view',               'audit',        'View audit log',        'Read audit events within scope'),
  ('storage.file.upload',          'storage',      'Upload files',          'Upload files to private storage'),
  ('storage.file.download',        'storage',      'Download files',        'Download files via signed URLs')
on conflict (key) do nothing;

insert into public.roles (key, name, description, is_system) values
  ('owner',         'Owner',         'Business owner. Full access; sole authority for company lifecycle and phase gates.', true),
  ('administrator', 'Administrator', 'Administration of organization structure and users within granted companies.',        true),
  ('manager',       'Manager',       'Operational management within granted scopes; module permissions arrive per phase.',  true),
  ('employee',      'Employee',      'Standard operational access per granted module permissions.',                          true),
  ('viewer',        'Viewer',        'Read-only access within granted scopes.',                                              true)
on conflict (key) do nothing;

-- Owner: every permission, now and as later phases add to the catalog the
-- owner mapping is re-run in that phase's reference migration.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'owner'
on conflict do nothing;

-- Administrator: everything except company lifecycle (owner-only).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in (
    'organization.company.view',
    'organization.branch.manage',
    'organization.warehouse.manage',
    'organization.department.manage',
    'users.view', 'users.invite', 'users.update', 'users.suspend',
    'users.role.assign', 'users.scope.assign',
    'audit.log.view',
    'storage.file.upload', 'storage.file.download'
  )
where r.key = 'administrator'
on conflict do nothing;

-- Manager: read-oriented foundation set; module permissions come later.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in ('organization.company.view', 'users.view', 'storage.file.download')
where r.key = 'manager'
on conflict do nothing;

-- Employee and Viewer: company visibility only in Phase 01.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in ('organization.company.view')
where r.key in ('employee', 'viewer')
on conflict do nothing;
