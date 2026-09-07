-- Grant SELECT access to priest_packages table for anon users
--
-- The priest_packages table was created in 20260821000000_priest_system.sql but was
-- not included in the anon SELECT grants when migration 20261201000005 revoked
-- anon access to most tables. This caused the Auth Promotion component to fail
-- when querying priest_packages with the anon key.
--
-- This migration grants table-level SELECT permission to anon. The existing RLS
-- policies on priest_packages continue to protect sensitive data:
--   CREATE POLICY priest_packages_read ON public.priest_packages 
--   FOR SELECT 
--   USING ((status='active') OR public.owns_priest(provider_id));

BEGIN;

GRANT SELECT ON TABLE public.priest_packages TO anon;

COMMIT;
