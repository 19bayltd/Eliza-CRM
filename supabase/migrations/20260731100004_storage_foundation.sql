-- Migration: private file-storage foundation
-- Purpose: file metadata registry and the first private bucket
--          (system-exports). Module buckets arrive with their phases per
--          docs/FILE_STORAGE_POLICY.md.
-- Rollback: drop table public.file_metadata; delete from storage.buckets
--           where id = 'system-exports' (only if empty).
-- Notes: bucket is PRIVATE (public = false). No storage.objects policies
--        are created for anon/authenticated, so all object access goes
--        through the server storage service (service role) which enforces
--        permissions, issues short-lived signed URLs, and audits access.

insert into storage.buckets (id, name, public)
values ('system-exports', 'system-exports', false)
on conflict (id) do nothing;

create table public.file_metadata (
  id             uuid primary key default gen_random_uuid(),
  bucket         text not null,
  path           text not null,
  company_id     uuid not null references public.companies (id) on delete restrict,
  entity_type    text,
  entity_id      text,
  classification text not null default 'confidential'
                 constraint file_metadata_classification_valid
                 check (classification in ('public', 'internal', 'confidential', 'highly_confidential')),
  size_bytes     bigint not null check (size_bytes >= 0),
  mime_type      text not null,
  original_name  text not null,
  status         text not null default 'active'
                 constraint file_metadata_status_valid check (status in ('active', 'deleted')),
  uploaded_by    uuid not null references auth.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (bucket, path)
);

create index file_metadata_company_idx on public.file_metadata (company_id);
create index file_metadata_entity_idx on public.file_metadata (entity_type, entity_id);

create trigger set_updated_at before update on public.file_metadata
  for each row execute function app.set_updated_at();

-- File records are managed exclusively by the server storage service.
revoke insert, update, delete, truncate on public.file_metadata
from anon, authenticated;
