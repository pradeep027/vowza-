-- PHASE_vendor_settlements_rls_lockdown.sql
--
-- PARKED — DO NOT MOVE INTO supabase/migrations/ UNTIL THE PRECONDITION BELOW
-- HOLDS. `supabase db push` applies every file in migrations/; this folder is
-- the only reliable "apply later". See migrations-pending/README.md.
--
-- P0 Phase D (payment / settlement integrity) — phase 2 of two. Revokes the
-- wide-open settlement write policies so a signed-in user can no longer
-- fabricate or rewrite ANY vendor_settlements row from the browser.
--
-- THE HOLE: 20260908000000_booking_execution_lifecycle.sql shipped
--     authenticated_insert_settlements  INSERT WITH CHECK (auth.uid() IS NOT NULL)
--     authenticated_update_settlements   UPDATE USING      (auth.uid() IS NOT NULL)
-- i.e. ANY authenticated user may INSERT any settlement (any vendor_id,
-- any booking_amount, any vendor_earnings) and UPDATE any existing settlement.
-- Combined with a client that computed its own payout, a vendor could fabricate
-- earnings outright.
--
-- THE FIX (two phases, asymmetric vs the Vercel deploy):
--   Phase 1 (ADDITIVE, already in migrations/):
--     20261242000000_complete_booking_service_authoritative.sql adds the
--     SECURITY DEFINER RPC complete_booking_service, which inserts the
--     settlement server-side with server-derived money. As the function owner it
--     bypasses RLS, so it keeps working after the broad policies are gone.
--   Phase 2a (frontend, in the working tree):
--     src/services/bookingExecutionService.ts::completeService now calls the RPC
--     instead of raw-inserting vendor_settlements; VendorBookings.tsx passes only
--     (bookingId, source). No browser code writes vendor_settlements any more.
--   Phase 2b (THIS FILE, withheld):
--     Drop the two broad policies; add an admin-only UPDATE (settle/dispute).
--     The SELECT policies (vendor/customer/admin) are unchanged.
--
-- Applying 2b while the OLD bundle is still served BREAKS completion: that
-- bundle raw-inserts the settlement, and 2b is exactly what starts returning
-- 403 for it. Phase 1 is harmless on its own; the hazard is only ever
-- 2b-before-2a-live. This is why 2b is withheld here, NOT shipped with the RPC.
--
-- CLASSIFICATION: SECURITY FIX. This TIGHTENS RLS (removes settlement
--   fabrication / rewrite); it never weakens it.
--
-- PROMOTING IT (see migrations-pending/README.md): confirm the RPC exists;
--   deploy the 2a frontend; verify the SERVED production bundle completes a
--   service through the RPC (a fresh vendor_settlements row whose
--   vendor_user_id = the provider and whose amounts match platform_settings);
--   THEN `git mv` this into supabase/migrations/ as
--   <next-timestamp>_vendor_settlements_rls_lockdown.sql and push. Negative
--   probe afterwards: as an ordinary authenticated user, a direct
--   POST /rest/v1/vendor_settlements must return 403, and so must a PATCH.
--
-- ROLLBACK: recreate the two dropped policies (bodies quoted above) and
--   DROP POLICY admin_update_settlements ON public.vendor_settlements;
BEGIN;

SET search_path = public, pg_temp;
-- ===========================================================================
-- FAIL-CLOSED PRECONDITION. Refuse to tighten the policies unless the
-- server-side replacement write path (the SECURITY DEFINER RPC) is already
-- installed. Promoting 2b without Phase 1 live would leave NOTHING able to
-- write a settlement.
-- ===========================================================================
DO $catalog$
BEGIN
    IF to_regclass('public.vendor_settlements') IS NULL THEN
        RAISE EXCEPTION 'ABORT lockdown: public.vendor_settlements does not exist.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'vendor_settlements' AND c.relrowsecurity
    ) THEN
        RAISE EXCEPTION 'ABORT lockdown: RLS is not enabled on vendor_settlements.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'complete_booking_service'
    ) THEN
        RAISE EXCEPTION 'ABORT lockdown: complete_booking_service RPC is not installed (Phase 1 must ship first).';
    END IF;
    RAISE NOTICE 'OK: vendor_settlements lockdown preconditions satisfied.';
END $catalog$;
-- ===========================================================================
-- LOCKDOWN. Remove the two auth.uid()-only write policies that let any
-- signed-in user fabricate or rewrite a settlement. After this, the ONLY INSERT
-- path is the SECURITY DEFINER RPC (its owner bypasses RLS), and the only
-- UPDATE path is an admin resolving/settling. The scoped SELECT policies
-- (vendor_select_own / customer_select_own / admin_select_all) are untouched.
-- ===========================================================================
DROP POLICY IF EXISTS "authenticated_insert_settlements" ON public.vendor_settlements;
DROP POLICY IF EXISTS "authenticated_update_settlements" ON public.vendor_settlements;

-- Admins settle / dispute; same role check as admin_select_all_settlements.
CREATE POLICY "admin_update_settlements" ON public.vendor_settlements
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin'))
);
-- ===========================================================================
-- FAIL-CLOSED SELF-CHECK. The broad write policies are gone, the admin UPDATE
-- is in place, the scoped SELECTs survive, RLS is still on, and NO policy lets
-- a plain authenticated user INSERT.
-- ===========================================================================
DO $verify$
DECLARE
    v_insert_policies int;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_settlements' AND policyname='authenticated_insert_settlements') THEN
        RAISE EXCEPTION 'FAILED: authenticated_insert_settlements still present.';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_settlements' AND policyname='authenticated_update_settlements') THEN
        RAISE EXCEPTION 'FAILED: authenticated_update_settlements still present.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_settlements' AND policyname='admin_update_settlements') THEN
        RAISE EXCEPTION 'FAILED: admin_update_settlements was not created.';
    END IF;
    FOR v_insert_policies IN
        SELECT 1 FROM pg_policies
         WHERE schemaname='public' AND tablename='vendor_settlements' AND cmd IN ('INSERT','ALL')
    LOOP
        RAISE EXCEPTION 'FAILED: an INSERT/ALL policy still lets clients write settlements.';
    END LOOP;
    IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='vendor_settlements'
         AND policyname IN ('vendor_select_own_settlements','customer_select_own_settlements','admin_select_all_settlements')) <> 3 THEN
        RAISE EXCEPTION 'FAILED: a scoped SELECT policy was lost.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                    WHERE n.nspname='public' AND c.relname='vendor_settlements' AND c.relrowsecurity) THEN
        RAISE EXCEPTION 'FAILED: RLS was disabled on vendor_settlements.';
    END IF;
    RAISE NOTICE 'OK: vendor_settlements write path locked to RPC + admin.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
