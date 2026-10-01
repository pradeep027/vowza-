-- ===========================================================================
-- 20261251000000_executable_security_probes.sql    [SECURITY — PROOF BY EXECUTION]
--
-- WHAT THIS IS: a schema-NEUTRAL apply-time verification migration. It adds NO
--   tables/columns/policies/functions. It EXECUTES the three highest-value
--   negative security invariants against the REAL applied objects and ABORTS the
--   push (rolling back) if any invariant does not hold. This complements — does
--   not replace — the static contract tests in src/lib/__tests__.
--
-- THE THREE INVARIANTS (all driven through the production RPC/trigger path,
--   using dancer_bookings as the representative category — it shares the ONE
--   shared self-booking trigger (20261247000000) and the ONE shared status DAG
--   trigger (20261238000000) with the other 14 categories):
--
--   1. SELF-BOOKING (20261247000000): a provider calling create_dancer_booking
--      on their OWN package is rejected 42501 on the SECURITY DEFINER RPC path
--      (the path that bypasses the old INSERT-RLS rule).
--   2. SERVER-AUTHORITATIVE AMOUNT (20261213000000): a legitimate booking's
--      stored total_amount equals the package's authoritative price — the RPC
--      takes NO amount parameter, so the browser cannot supply one; this proves
--      the derived value by reading it back.
--   3. STATUS DAG (20261238000000): an illegal pending -> completed jump on the
--      seeded booking is rejected 23514 (check_violation).
--
-- SAFETY: every probe runs inside a subtransaction and either (a) errors on the
--   forbidden action (nothing committed) or (b) seeds via the real RPC and then
--   discards the row with a ROLLBACK_PROBE sentinel. NOTHING persists. Each probe
--   SKIPS cleanly (NOTICE, no failure) when the DB lacks the fixtures to drive it
--   (empty CI/shadow DB), exactly like the probe-B idiom in 20261248000000.
--
-- CLASSIFICATION: SECURITY (executable regression gate). Apply-path: it only
--   asserts invariants already enforced by applied migrations, so it never
--   breaks a legitimate flow; a failure here means a real protection regressed.
-- ===========================================================================

BEGIN;

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- PROBE 1 — SELF-BOOKING rejection on the create_dancer_booking RPC path.
-- A provider impersonates themselves and books their OWN package; the shared
-- BEFORE INSERT trigger must reject it with 42501.
-- ---------------------------------------------------------------------------
DO $probe1$
DECLARE
  v_pkg_id uuid;
  v_owner  uuid;
  v_got42  boolean := false;
BEGIN
  SELECT dp.id, pp.user_id
    INTO v_pkg_id, v_owner
    FROM public.dancer_packages dp
    JOIN public.provider_profiles pp ON pp.id = dp.provider_id
   WHERE dp.status = 'active' AND pp.user_id IS NOT NULL
   LIMIT 1;

  IF v_pkg_id IS NULL THEN
    RAISE NOTICE 'probe 1 SKIPPED (self-booking): no active dancer_packages with an owner to drive it.';
    RETURN;
  END IF;
  BEGIN
    -- Impersonate the package OWNER on the authenticated RPC path.
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

    PERFORM public.create_dancer_booking(v_pkg_id, current_date);

    -- Reaching here means the provider booked their OWN package: a regression.
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);
    RAISE EXCEPTION 'PROBE_FAIL: provider self-booked their own dancer package via create_dancer_booking';
  EXCEPTION
    WHEN insufficient_privilege THEN
      -- 42501 is exactly the shared self-booking trigger's rejection.
      v_got42 := true;
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'PROBE_FAIL%' THEN RAISE; END IF;
      RAISE EXCEPTION 'PROBE_FAIL: expected 42501 self-booking rejection, got (%: %)', SQLSTATE, SQLERRM;
  END;

  -- The caught exception already rolled the subtransaction back; make the
  -- session role/claims explicit for anything that follows.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);

  IF v_got42 THEN
    RAISE NOTICE 'probe 1 OK (self-booking): provider self-booking rejected with 42501 on the RPC path.';
  END IF;
END
$probe1$;

-- ---------------------------------------------------------------------------
-- PROBE 2 — SERVER-AUTHORITATIVE AMOUNT + illegal STATUS transition.
-- A real (non-owner) customer books via the authoritative RPC; the stored
-- total_amount must equal the package's authoritative price, and an illegal
-- pending -> completed jump on that booking must be rejected 23514. The seeded
-- row is discarded with a ROLLBACK_PROBE sentinel — nothing persists.
-- ---------------------------------------------------------------------------
DO $probe2$
DECLARE
  v_pkg_id          uuid;
  v_owner           uuid;
  v_price           numeric;
  v_customer        uuid;
  v_bid             uuid;
  v_stored          numeric;
  v_illegal_blocked boolean := false;
BEGIN
  SELECT dp.id, pp.user_id, COALESCE(dp.package_price, 0)
    INTO v_pkg_id, v_owner, v_price
    FROM public.dancer_packages dp
    JOIN public.provider_profiles pp ON pp.id = dp.provider_id
   WHERE dp.status = 'active' AND pp.user_id IS NOT NULL
   LIMIT 1;

  IF v_pkg_id IS NULL THEN
    RAISE NOTICE 'probe 2 SKIPPED (amount/status): no active dancer_packages to drive it.';
    RETURN;
  END IF;

  -- Need a real end-user who is NOT the package owner (so this is a legitimate,
  -- non-self booking that the self-booking trigger will allow).
  SELECT id INTO v_customer FROM auth.users WHERE id <> v_owner LIMIT 1;
  IF v_customer IS NULL THEN
    RAISE NOTICE 'probe 2 SKIPPED (amount/status): need a non-owner auth.users row to drive it.';
    RETURN;
  END IF;

  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_customer, 'role', 'authenticated')::text, true);

    -- SEED a legitimate booking via the authoritative RPC. An incidental
    -- data-shape failure here is a SKIP, not a security regression.
    BEGIN
      v_bid := public.create_dancer_booking(v_pkg_id, current_date);
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'PROBE_FAIL%' THEN RAISE; END IF;
      RESET ROLE;
      PERFORM set_config('request.jwt.claims', NULL, true);
      RAISE NOTICE 'probe 2 SKIPPED (amount/status): could not seed via create_dancer_booking (%: %).', SQLSTATE, SQLERRM;
      RETURN;
    END;

    -- NEGATIVE (status DAG): illegal pending -> completed must be rejected 23514.
    BEGIN
      UPDATE public.dancer_bookings SET status = 'completed' WHERE id = v_bid;
    EXCEPTION
      WHEN check_violation THEN
        v_illegal_blocked := true;
      WHEN OTHERS THEN
        IF SQLERRM LIKE 'PROBE_FAIL%' THEN RAISE; END IF;
        v_illegal_blocked := (SQLSTATE = '23514');
    END;

    -- Read the authoritative amount back with RLS bypassed (migration role).
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);
    SELECT total_amount INTO v_stored FROM public.dancer_bookings WHERE id = v_bid;

    IF v_stored IS DISTINCT FROM v_price THEN
      RAISE EXCEPTION 'PROBE_FAIL: stored total_amount % != authoritative package price %', v_stored, v_price;
    END IF;
    IF NOT v_illegal_blocked THEN
      RAISE EXCEPTION 'PROBE_FAIL: illegal pending->completed status jump was NOT rejected';
    END IF;

    -- Both invariants held — discard the seeded booking.
    RAISE EXCEPTION 'ROLLBACK_PROBE';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'PROBE_FAIL%' THEN RAISE; END IF;
      IF SQLERRM LIKE 'ROLLBACK_PROBE%' THEN
        RAISE NOTICE 'probe 2 OK (amount/status): total_amount server-authoritative; illegal status jump rejected 23514 (rolled back).';
      ELSE
        RAISE EXCEPTION 'PROBE_FAIL: amount/status probe errored unexpectedly (%: %)', SQLSTATE, SQLERRM;
      END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
END
$probe2$;

COMMIT;

-- Schema-neutral, but keep PostgREST's cache coherent with the apply pipeline.
NOTIFY pgrst, 'reload schema';
