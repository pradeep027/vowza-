-- ===========================================================================
-- 20261250000000_tighten_generic_bookings_update_policy.sql   [P1 — SECURITY FIX]
--
-- THE FINDING (consistency / defense-in-depth; LOWER severity than it first looks):
--   The generic public.bookings UPDATE policy (baseline CONSOLIDATED_MIGRATION):
--     CREATE POLICY "Booking parties can update" ON public.bookings FOR UPDATE
--       USING (auth.uid() = customer_id
--              OR EXISTS (SELECT 1 FROM public.provider_profiles
--                         WHERE id = provider_id AND user_id = auth.uid()));
--   has two shape gaps vs. its hardened category peers:
--     (a) no `TO authenticated` -- it is written against PUBLIC;
--     (b) no explicit `WITH CHECK`.
--
-- WHY IT IS NOT A GAPING HOLE (traced, stated honestly):
--   * anon is fully REVOKEd from public.bookings at the grant level
--     (20261201000005_revoke_anon_writes_and_enable_rls), and an executable anon
--     probe there already asserts the table is unreachable by anon. So in
--     practice only `authenticated` can reach this policy today.
--   * For an UPDATE policy with no WITH CHECK, Postgres REUSES the USING
--     expression as the new-row check -- so the ownership constraint already
--     applies to the post-update row. The missing WITH CHECK is therefore a
--     clarity/robustness gap, not an open write.
--   This migration is hardening + peer consistency, not the closing of an active
--   exploit.
--
-- THE FIX (SECURITY FIX; predicate-preserving):
--   Recreate the policy with the SAME name and the SAME ownership predicate, but
--   scoped `TO authenticated` and with an EXPLICIT `WITH CHECK` equal to USING.
--   This narrows the role surface (removing the vacuous PUBLIC scope) and pins
--   the new-row ownership check so it can never silently diverge from USING.
--
-- EXPLICITLY NOT DONE HERE: no column-level / financial lockdown (that is the
--   PARKED Phase B companion). This touches ONLY the policy role + WITH CHECK;
--   the status DAG + actor binding remain enforced by the bookings status
--   triggers (20261237000000 / 20261240000000).
--
-- WHY APPLY-PATH (not parked): the predicate is unchanged and anon was already
--   revoked, so no legitimate authenticated writer (whose rows already satisfy
--   the USING-reused check) is affected; admin/service_role writes bypass RLS.
--
-- PROOF BY EXECUTION: an anon UPDATE probe (denied at the table grant) + a
--   catalog assertion that the policy is TO authenticated with a non-null
--   WITH CHECK carrying the ownership predicate.
-- ===========================================================================

BEGIN;

DROP POLICY IF EXISTS "Booking parties can update" ON public.bookings;
CREATE POLICY "Booking parties can update" ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = customer_id
    OR EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = customer_id
    OR EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid())
  );

-- Executable probe: anon cannot even reach the table (grant-level revoke).
DO $probe$
BEGIN
  SET LOCAL ROLE anon;
  UPDATE public.bookings SET status = status WHERE id = '00000000-0000-0000-0000-000000000000';
  RAISE EXCEPTION 'PROBE_FAIL: anon UPDATE on public.bookings was NOT rejected';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'probe OK: anon UPDATE on public.bookings rejected (42501).';
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'PROBE_FAIL%' THEN RAISE; END IF;
    RAISE NOTICE 'probe OK: anon UPDATE on public.bookings rejected (%: %).', SQLSTATE, SQLERRM;
END;
$probe$;

-- Catalog assertion: policy is TO authenticated with a non-null WITH CHECK that
-- carries the ownership predicate (aborts the push on drift).
DO $assert$
DECLARE
  v_cmd   text;
  v_roles name[];
  v_check text;
BEGIN
  SELECT cmd, roles, with_check
    INTO v_cmd, v_roles, v_check
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename  = 'bookings'
     AND policyname = 'Booking parties can update';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'generic bookings UPDATE assert FAILED: policy missing';
  END IF;
  IF v_cmd <> 'UPDATE' THEN
    RAISE EXCEPTION 'generic bookings UPDATE assert FAILED: cmd % is not UPDATE', v_cmd;
  END IF;
  IF NOT ('authenticated' = ANY (v_roles)) OR ('public' = ANY (v_roles)) THEN
    RAISE EXCEPTION 'generic bookings UPDATE assert FAILED: not scoped strictly TO authenticated (roles=%)', v_roles;
  END IF;
  IF v_check IS NULL OR position('customer_id' IN v_check) = 0 OR position('provider_profiles' IN v_check) = 0 THEN
    RAISE EXCEPTION 'generic bookings UPDATE assert FAILED: WITH CHECK missing/!ownership (with_check=%)', v_check;
  END IF;
  RAISE NOTICE 'generic bookings UPDATE assert OK: TO authenticated with explicit ownership WITH CHECK.';
END;
$assert$;

COMMIT;

-- Reload PostgREST's schema cache so the recreated policy applies immediately.
NOTIFY pgrst, 'reload schema';
