-- Migration: an issued purchase order must name a destination warehouse (Phase 05)
-- Purpose: Phase 05 made receiving post stock into a warehouse, so an order
--          that is a live commitment has to say where the goods land. The
--          first attempt at this rule lived only in the service layer, which
--          is the same gap this phase already had to fix once (the derived-
--          balances function that was attached to no trigger). The rule is
--          now a database constraint as well:
--            * a DRAFT may have no destination — a company that has not yet
--              created a warehouse must still be able to start an order;
--            * a CANCELLED order keeps whatever it had, including nothing;
--            * ISSUED / PARTIALLY_RECEIVED / RECEIVED must have one.
--          Company integrity is already enforced by the composite foreign key
--          purchase_orders_warehouse_company_fkey (20260806150006), so a
--          destination can never belong to another company.
-- Rollback: alter table public.purchase_orders
--             drop constraint purchase_orders_issued_needs_destination;
-- Notes: declared NOT VALID on purpose. Staging holds one purchase order
--        from Phase 04 (status 'received') that was created before the
--        column existed and has no destination. Back-filling it would invent
--        a fact about a delivery nobody recorded. NOT VALID leaves that row
--        alone while enforcing the rule on every insert and update from now
--        on — including any update to that row itself. Run
--          alter table public.purchase_orders
--            validate constraint purchase_orders_issued_needs_destination;
--        once the legacy row is retired, if a fully validated constraint is
--        wanted.

alter table public.purchase_orders
  add constraint purchase_orders_issued_needs_destination
  check (warehouse_id is not null or status in ('draft', 'cancelled'))
  not valid;

comment on constraint purchase_orders_issued_needs_destination
  on public.purchase_orders is
  'Receiving posts stock into warehouse_id, so an order past draft must have one. Drafts may not yet.';
