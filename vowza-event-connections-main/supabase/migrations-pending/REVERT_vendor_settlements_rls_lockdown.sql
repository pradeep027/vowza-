-- REVERT_vendor_settlements_rls_lockdown.sql
--
-- PARKED RECOVERY ARTIFACT — the documented inverse of
-- supabase/migrations/20261252000000_vendor_settlements_rls_lockdown.sql.
--
-- This exists ONLY as the rollback path for the vendor_settlements RLS lockdown.
-- The Supabase project is on the FREE plan: no automated backup / PITR recovery
-- point was available when the lockdown was applied (2026-10-02), so recovery
-- relies on (a) the lockdown being transactional — any failure in its
-- $catalog$ / $verify$ blocks rolls the whole thing back and leaves prod
-- untouched — and (b) this inverse, applied by hand only if the lockdown
-- committed and then had to be undone.
--
-- IT RESTORES THE PRE-LOCKDOWN STATE verbatim from genesis
-- (20260908000000_booking_execution_lifecycle.sql):
--   authenticated_insert_settlements  INSERT WITH CHECK (auth.uid() IS NOT NULL)
--   authenticated_update_settlements   UPDATE USING      (auth.uid() IS NOT NULL)
-- and drops the admin-only UPDATE the lockdown added.
--
-- WARNING: applying this RE-OPENS the settlement fabrication / rewrite hole
-- (ANY signed-in user could INSERT a fabricated settlement or UPDATE any row).
-- Use it ONLY to recover a broken service-completion flow, and re-lock as soon
-- as the root cause is fixed. It is DELIBERATELY withheld from
-- supabase/migrations/ — it is not a migration to apply in the normal course.
--
-- TO USE: git mv into supabase/migrations/ as
--   <next-timestamp>_revert_vendor_settlements_rls_lockdown.sql and push.
--
-- CLASSIFICATION: SECURITY-REVERSAL (recovery only). Loosens RLS back to the
--   pre-lockdown baseline; never run except to recover from a failed rollout.
BEGIN;

SET search_path = public, pg_temp;

-- Remove the admin-only UPDATE the lockdown introduced.
DROP POLICY IF EXISTS "admin_update_settlements" ON public.vendor_settlements;

-- Recreate the two broad write policies exactly as genesis shipped them.
DROP POLICY IF EXISTS "authenticated_insert_settlements" ON public.vendor_settlements;
DROP POLICY IF EXISTS "authenticated_update_settlements" ON public.vendor_settlements;

CREATE POLICY "authenticated_insert_settlements" ON public.vendor_settlements
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_update_settlements" ON public.vendor_settlements
FOR UPDATE
USING (auth.uid() IS NOT NULL);

COMMIT;

NOTIFY pgrst, 'reload schema';
