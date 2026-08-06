-- Migration: warehouses become a company-integrity parent (Phase 05)
-- Purpose: warehouses were only ever a child in the composite-key scheme
--          (20260806130001 pinned them to their branch). Phase 05 makes
--          them a parent of ledger entries, transfers, counts and
--          locations, which need the same (id, company_id) key.
-- Rollback: alter table public.warehouses drop constraint warehouses_id_company_key;
alter table public.warehouses
  add constraint warehouses_id_company_key unique (id, company_id);
