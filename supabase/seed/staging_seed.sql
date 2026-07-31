-- Staging seed: initial companies (owner-approved Phase 01 decision).
-- Idempotent: keyed on company code; never keyed on hard-coded UUIDs.
-- Production application of this data is part of the Phase 01 production
-- deployment plan and requires owner approval.

insert into public.companies (code, name, base_currency, timezone) values
  ('ELIZA_SOURCE', 'Eliza Source', 'BDT', 'Asia/Dhaka'),
  ('19BAY',        '19BAY',        'BDT', 'Asia/Dhaka'),
  ('ONE_AND_NINE', '1 & 9',        'USD', 'Asia/Dhaka')
on conflict (code) do nothing;
