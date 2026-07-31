-- Migration: app schema usage grant
-- Purpose: authenticated sessions must be able to evaluate the app.*
--          authorization helpers directly (RLS policies referencing them
--          work regardless, but direct evaluation failed schema USAGE —
--          found by the Phase 01 staging RLS verification).
-- Rollback: revoke usage on schema app from authenticated.

grant usage on schema app to authenticated;
