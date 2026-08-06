-- Migration: confidential tables become server-only (review finding)
-- Purpose: direct client SELECT on supplier_quotation_costs and
--          product_intelligence allowed permission holders to read
--          confidential values WITHOUT the promised read-audit (the
--          audit fires only on the server path). Both tables now have
--          RLS enabled with NO policies — deny-all for clients, exactly
--          like audit_log — so every read flows through the audited
--          server services (service role unaffected).
-- Rollback: recreate the two select policies from 20260805110001 /
--           20260806120001.
drop policy if exists supplier_quotation_costs_select on public.supplier_quotation_costs;
drop policy if exists product_intelligence_select on public.product_intelligence;
