-- ===========================================================================
-- 20261249000000_dancer_bookings_customer_update_policy.sql     [P1 — BUG FIX]
--
-- THE GAP (authorization parity, REPO-VERIFIED):
--   All 14 non-photography category booking tables carry a
--   `<cat>_bookings_customer_update` RLS policy
--   (FOR UPDATE TO authenticated USING (customer_id = auth.uid())
--    WITH CHECK (customer_id = auth.uid())) -- e.g. band_bookings_customer_update,
--   singer_bookings_customer_update, dj_bookings_customer_update, ...
--   dancer_bookings is the ONLY category MISSING it (migrations-archive/
--   CONSOLIDATED_MIGRATION.sql defines dancer_bookings_read / _customer_insert /
--   _provider_update, but no _customer_update).
--
-- WHY THIS IS A REAL GAP, NOT COSMETIC (caller trace):
--   src/hooks/useBookings.ts cancelBooking() issues a direct customer
--   `.update({ status: 'cancelled' })` per category, INCLUDING the dancer branch
--   (`source === 'dancer' -> dancer_bookings.update(...)`). With no customer
--   UPDATE policy, RLS filters the row out: the update matches 0 rows and the
--   customer's dancer-booking cancellation SILENTLY fails. The 14 peers work.
--
-- THE FIX (BUG FIX; additive, mirrors the 14 peers exactly):
--   1. Add dancer_bookings_customer_update in the canonical peer form.
--   2. Harden the pre-existing dancer_bookings_provider_update to full parity
--      with its peers (TO authenticated + explicit WITH CHECK, predicate-
--      preserving -- the EXISTS(...) membership is equivalent to the prior
--      `provider_id IN (...)`). BEHAVIOR PRESERVATION / defense-in-depth.
--
-- WHY SAFE / NOT OVER-PERMISSIVE:
--   The policy only decides WHICH rows the customer may touch (their own). WHICH
--   transition is still governed by the shared BEFORE UPDATE status trigger
--   (20261238000000 enforce_category_booking_status_transition), which covers
--   dancer and permits a customer cancel (pending/accepted/in_progress ->
--   cancelled) while rejecting illegal jumps. So this restores the intended
--   customer-cancel path without weakening the state machine. The table was
--   already stripped of anon writes (20261201000005), so only authenticated
--   callers reach these policies.
--
-- WHY APPLY-PATH (not parked): purely additive authz that UNBLOCKS a legitimate
--   customer flow; it closes no column and breaks nothing already live.
--
-- PROOF BY EXECUTION: an apply-time catalog assertion verifies the new policy
--   exists with cmd=UPDATE, is scoped TO authenticated, and carries
--   `customer_id = auth.uid()` in BOTH USING and WITH CHECK (and that the
--   provider policy was hardened), aborting the push otherwise.
-- ===========================================================================

BEGIN;

-- 1. The missing customer UPDATE policy -- canonical peer form.
DROP POLICY IF EXISTS dancer_bookings_customer_update ON public.dancer_bookings;
CREATE POLICY dancer_bookings_customer_update ON public.dancer_bookings
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- 2. Harden the provider UPDATE policy to full peer parity (predicate-preserving:
--    the EXISTS membership equals the prior `provider_id IN (...)`).
DROP POLICY IF EXISTS dancer_bookings_provider_update ON public.dancer_bookings;
CREATE POLICY dancer_bookings_provider_update ON public.dancer_bookings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = auth.uid()));

-- 3. Apply-time catalog assertion (aborts the push on drift).
DO $assert$
DECLARE
  v_cmd   text;
  v_roles name[];
  v_qual  text;
  v_check text;
BEGIN
  SELECT cmd, roles, qual, with_check
    INTO v_cmd, v_roles, v_qual, v_check
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename  = 'dancer_bookings'
     AND policyname = 'dancer_bookings_customer_update';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'dancer customer_update assert FAILED: policy missing';
  END IF;
  IF v_cmd <> 'UPDATE' THEN
    RAISE EXCEPTION 'dancer customer_update assert FAILED: cmd % is not UPDATE', v_cmd;
  END IF;
  IF NOT ('authenticated' = ANY (v_roles)) THEN
    RAISE EXCEPTION 'dancer customer_update assert FAILED: not scoped TO authenticated (roles=%)', v_roles;
  END IF;
  IF v_qual IS NULL OR position('customer_id = auth.uid()' IN v_qual) = 0 THEN
    RAISE EXCEPTION 'dancer customer_update assert FAILED: USING lacks customer_id = auth.uid() (qual=%)', v_qual;
  END IF;
  IF v_check IS NULL OR position('customer_id = auth.uid()' IN v_check) = 0 THEN
    RAISE EXCEPTION 'dancer customer_update assert FAILED: WITH CHECK lacks customer_id = auth.uid() (with_check=%)', v_check;
  END IF;

  -- Provider policy hardened to parity (TO authenticated + WITH CHECK present).
  SELECT cmd, roles, with_check
    INTO v_cmd, v_roles, v_check
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename  = 'dancer_bookings'
     AND policyname = 'dancer_bookings_provider_update';
  IF NOT FOUND OR v_cmd <> 'UPDATE' OR NOT ('authenticated' = ANY (v_roles)) OR v_check IS NULL THEN
    RAISE EXCEPTION 'dancer provider_update assert FAILED: not hardened (cmd=%, roles=%, with_check=%)', v_cmd, v_roles, v_check;
  END IF;

  RAISE NOTICE 'dancer_bookings UPDATE parity assert OK: customer + provider policies TO authenticated with USING + WITH CHECK.';
END;
$assert$;

COMMIT;

-- Reload PostgREST's schema cache so the new policies apply immediately.
NOTIFY pgrst, 'reload schema';
