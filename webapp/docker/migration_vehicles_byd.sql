-- Family Dashbox: allow vendor='byd' on the vehicles table.
--
-- The native BYD driver (no Home Assistant) inserts rows with vendor='byd',
-- but migration_vehicles.sql's CHECK only permits 'tesla'/'generic-ev'.
-- Postgres has no `ADD CONSTRAINT IF NOT EXISTS` for CHECKs, so we drop and
-- re-add. The constraint's implicit name is `vehicles_vendor_check`.
-- Idempotent: safe to re-run.

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_vendor_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_vendor_check
  CHECK (vendor IN ('tesla', 'generic-ev', 'byd'));
