-- Migration: stock_balances key allows a null variant (Phase 05)
-- Purpose: a primary key cannot contain a nullable column, but a product
--          without variants has variant_id null — the original key made
--          balances for variant-less products impossible to write
--          (caught by the first staging probe, before any code shipped).
--          Replaced with a surrogate id plus a unique index that treats
--          NULL as a value (PostgreSQL 15+), so "this product, no
--          variant" is one addressable balance row.
-- Rollback: drop index stock_balances_key; drop column id;
--           re-add the composite primary key (only valid if no
--           variant-less balances exist).
alter table public.stock_balances drop constraint stock_balances_pkey;

alter table public.stock_balances
  add column id uuid primary key default gen_random_uuid();

create unique index stock_balances_key
  on public.stock_balances (warehouse_id, product_id, variant_id)
  nulls not distinct;

-- Dropping the primary key leaves its columns NOT NULL.
alter table public.stock_balances alter column variant_id drop not null;
