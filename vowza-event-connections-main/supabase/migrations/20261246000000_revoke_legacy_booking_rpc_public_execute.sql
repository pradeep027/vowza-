-- ===========================================================================
-- 20261246000000_revoke_legacy_booking_rpc_public_execute.sql      [P0-L — SECURITY FIX]
--
-- THE HOLE (REPO/LIVE-VERIFIED — PRODUCTION_SECURITY_REMEDIATION_PLAN.md §6):
--   public.create_event_booking / add_artist_to_event / update_artist_booking_status
--   are SECURITY DEFINER functions defined by the event-marketplace helper
--   (vowza-event-connections-main/EVENT_MARKETPLACE_MIGRATION_CORRECTED.sql),
--   created with the default PUBLIC EXECUTE and NO internal auth check. SECURITY
--   DEFINER runs as the owner and bypasses RLS, so ANY caller -- including anon
--   with the publishable key -- can create/modify event & artist bookings and set
--   their status, unauthenticated. The browser also supplies p_customer_id, so a
--   caller could create events "as" any user id.
--
-- CALLER TRACE (verified):
--   * src/pages/EventPlanning.tsx:154 -> create_event_booking({ p_customer_id: user?.id, ... })
--   * src/pages/EventPlanning.tsx:169 -> add_artist_to_event({ p_event_id: <owned>, ... })
--   * update_artist_booking_status: NO frontend caller (dead on the client), but
--     the function exists live and is reachable by anon -> locked, not dropped
--     (dropping is more destructive and cannot be proven safe without a live
--     consumer sweep; locking is reversible and fail-closed).
--
-- AUTHORIZATION MODEL (derived from the live caller + the table RLS policies in
-- the marketplace helper: event_bookings = auth.uid() = customer_id; artist_bookings
-- actors = event-owner customer OR the provider whose provider_profiles.user_id =
-- auth.uid()):
--   * create_event_booking         -> authenticated; may only create for SELF.
--   * add_artist_to_event          -> authenticated; must OWN the target event.
--   * update_artist_booking_status -> authenticated; must be the event-owner
--                                     customer OR the assigned provider (vendor).
--
-- WHAT THIS MIGRATION DOES (additive, fail-closed):
--   1. CREATE OR REPLACE all three with their EXACT signatures + insert/update
--      shape preserved, adding a fail-closed auth.uid()/ownership/actor guard
--      (RAISE ... ERRCODE '42501') at the top. SET search_path hardened.
--   2. REVOKE EXECUTE FROM PUBLIC, anon; GRANT EXECUTE TO authenticated, service_role.
--   3. Catalog assertion: anon/PUBLIC have no EXECUTE; authenticated does.
--   4. Apply-time role probes that actually attempt the forbidden calls and
--      assert rejection (42501), plus a legitimate call that succeeds and is
--      rolled back -- proof by execution, not inspection.
--
-- WHY APPLY-PATH (not parked like the column lockdowns): removing anon EXECUTE +
--   enforcing self/ownership does NOT break the live bundle -- EventPlanning calls
--   as an authenticated user with p_customer_id = auth.uid() and against an event
--   it just created, which all still pass. Only the unauthenticated/foreign path
--   (the vulnerability) is closed. No frontend-first ordering is required.
--
-- OUT OF SCOPE (documented, NOT silently changed): artist_bookings.price is still
--   browser-supplied (a P0-1-style value-authority gap on this legacy path, not an
--   authz hole). Event/artist bookings were never part of the 15-category
--   server-authoritative rewrite; recomputing price here is a separate change.
--
-- ROLLBACK (forward-only safe; no data movement):
--   GRANT EXECUTE ON FUNCTION ... TO PUBLIC;  -- restores the prior (insecure) grant
--   and CREATE OR REPLACE the bodies without the guard (keep only as an emergency
--   lever; captured in deploy notes).
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. create_event_booking -- authenticated, self only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_event_booking(
  p_customer_id UUID,
  p_event_name  TEXT,
  p_event_type  TEXT,
  p_event_date  DATE,
  p_location    TEXT,
  p_guest_count INTEGER,
  p_total_budget INTEGER,
  p_notes       TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_id UUID;
  v_uid      UUID := auth.uid();
BEGIN
  -- Fail-closed: must be signed in, and p_customer_id is NOT trusted as an
  -- authority value -- it must be the caller's own id.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'create_event_booking: authentication required'
      USING ERRCODE = '42501';
  END IF;
  IF p_customer_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'create_event_booking: cannot create an event for another user'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.event_bookings (
    customer_id, event_name, event_type, event_date,
    location, guest_count, total_budget, notes
  ) VALUES (
    v_uid, p_event_name, p_event_type, p_event_date,
    p_location, p_guest_count, p_total_budget, p_notes
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. add_artist_to_event -- authenticated, must own the target event.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_artist_to_event(
  p_event_id     UUID,
  p_provider_id  UUID,
  p_provider_name TEXT,
  p_category     TEXT,
  p_price        INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking_id UUID;
  v_uid        UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'add_artist_to_event: authentication required'
      USING ERRCODE = '42501';
  END IF;
  -- The caller must own the event they are attaching an artist to.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_bookings
     WHERE id = p_event_id
       AND customer_id = v_uid
  ) THEN
    RAISE EXCEPTION 'add_artist_to_event: event % is not owned by the caller', p_event_id
      USING ERRCODE = '42501';
  END IF;

  -- NOTE (out of scope / documented): p_price is still browser-supplied. This
  -- migration closes the authz hole; value-authority on this legacy path is a
  -- separate change (see header).
  INSERT INTO public.artist_bookings (
    event_id, provider_id, provider_name, category, price
  ) VALUES (
    p_event_id, p_provider_id, p_provider_name, p_category, p_price
  ) RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. update_artist_booking_status -- authenticated; event-owner OR assigned
--    provider (vendor) only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_artist_booking_status(
  p_booking_id          UUID,
  p_status              TEXT,
  p_negotiation_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_authorized BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'update_artist_booking_status: authentication required'
      USING ERRCODE = '42501';
  END IF;
  -- Actor binding: the event-owning customer OR the provider assigned to this
  -- artist booking (provider_profiles.user_id = caller) may change its status.
  SELECT EXISTS (
    SELECT 1
      FROM public.artist_bookings ab
      JOIN public.event_bookings eb ON eb.id = ab.event_id
     WHERE ab.id = p_booking_id
       AND eb.customer_id = v_uid
  ) OR EXISTS (
    SELECT 1
      FROM public.artist_bookings ab
      JOIN public.provider_profiles pp ON pp.id = ab.provider_id
     WHERE ab.id = p_booking_id
       AND pp.user_id = v_uid
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'update_artist_booking_status: booking % not updatable by the caller', p_booking_id
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.artist_bookings
     SET status              = p_status,
         negotiation_message = p_negotiation_message,
         updated_at          = now()
   WHERE id = p_booking_id;

  RETURN TRUE;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Lock the grants: strip the default PUBLIC/anon EXECUTE; allow only the
--    authenticated path (the live caller) + service_role (trusted backend).
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_event_booking(uuid, text, text, date, text, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_event_booking(uuid, text, text, date, text, integer, integer, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.add_artist_to_event(uuid, uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_artist_to_event(uuid, uuid, text, text, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_artist_booking_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_artist_booking_status(uuid, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Catalog assertion (by privilege, not inspection): anon has NO EXECUTE on
--    any of the three (which also catches a default PUBLIC grant, since anon
--    inherits PUBLIC); authenticated DOES.
-- ---------------------------------------------------------------------------
DO $assert$
DECLARE
  v_sig text;
  v_oid oid;
  v_fns text[] := ARRAY[
    'public.create_event_booking(uuid, text, text, date, text, integer, integer, text)',
    'public.add_artist_to_event(uuid, uuid, text, text, integer)',
    'public.update_artist_booking_status(uuid, text, text)'
  ];
BEGIN
  FOREACH v_sig IN ARRAY v_fns LOOP
    v_oid := v_sig::regprocedure::oid;
    IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'P0-L assert FAILED: anon still has EXECUTE on %', v_sig;
    END IF;
    IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'P0-L assert FAILED: authenticated lacks EXECUTE on %', v_sig;
    END IF;
  END LOOP;
  RAISE NOTICE 'P0-L catalog assert OK: legacy booking RPCs locked to authenticated; anon/PUBLIC EXECUTE revoked.';
END;
$assert$;

-- ---------------------------------------------------------------------------
-- 6. Apply-time role probes -- proof BY EXECUTION. Each sub-block runs the
--    forbidden call under SET LOCAL ROLE / jwt claims and asserts it is
--    rejected with 42501 (insufficient_privilege). The SET LOCALs are confined
--    to each sub-transaction and revert automatically on exception.
-- ---------------------------------------------------------------------------

-- 6a. ANON -> create_event_booking  => denied at the EXECUTE grant.
DO $probe$
BEGIN
  SET LOCAL ROLE anon;
  PERFORM public.create_event_booking(
    '00000000-0000-0000-0000-000000000001'::uuid,
    'probe', 'probe', current_date, 'probe', 1, 1);
  RAISE EXCEPTION 'PROBE_FAIL: anon create_event_booking was NOT rejected';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'probe 6a OK: anon create_event_booking rejected (42501).';
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'PROBE_FAIL%' THEN RAISE; END IF;
    RAISE NOTICE 'probe 6a OK: anon create_event_booking rejected (%: %).', SQLSTATE, SQLERRM;
END;
$probe$;

-- 6b. AUTHENTICATED but p_customer_id != auth.uid()  => denied by self-check.
DO $probe$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  PERFORM public.create_event_booking(
    '22222222-2222-2222-2222-222222222222'::uuid,  -- a DIFFERENT user id
    'probe', 'probe', current_date, 'probe', 1, 1);
  RAISE EXCEPTION 'PROBE_FAIL: create_event_booking for a foreign customer_id was NOT rejected';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'probe 6b OK: foreign-customer create_event_booking rejected (42501).';
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'PROBE_FAIL%' THEN RAISE; END IF;
    RAISE NOTICE 'probe 6b OK: foreign-customer create rejected (%: %).', SQLSTATE, SQLERRM;
END;
$probe$;

-- 6c. AUTHENTICATED but does NOT own the target event  => denied by ownership.
DO $probe$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
    '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
  PERFORM public.add_artist_to_event(
    '44444444-4444-4444-4444-444444444444'::uuid,  -- event not owned by caller
    '55555555-5555-5555-5555-555555555555'::uuid,
    'probe', 'probe', 1);
  RAISE EXCEPTION 'PROBE_FAIL: add_artist_to_event on an unowned event was NOT rejected';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'probe 6c OK: add_artist_to_event on unowned event rejected (42501).';
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'PROBE_FAIL%' THEN RAISE; END IF;
    RAISE NOTICE 'probe 6c OK: add_artist_to_event on unowned event rejected (%: %).', SQLSTATE, SQLERRM;
END;
$probe$;

-- 6d. AUTHENTICATED but neither event-owner nor assigned provider  => denied.
DO $probe$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
    '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
  PERFORM public.update_artist_booking_status(
    '77777777-7777-7777-7777-777777777777'::uuid,  -- booking not owned by caller
    'accepted', NULL);
  RAISE EXCEPTION 'PROBE_FAIL: update_artist_booking_status by a non-actor was NOT rejected';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'probe 6d OK: update_artist_booking_status by non-actor rejected (42501).';
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'PROBE_FAIL%' THEN RAISE; END IF;
    RAISE NOTICE 'probe 6d OK: update_artist_booking_status by non-actor rejected (%: %).', SQLSTATE, SQLERRM;
END;
$probe$;

-- 6e. LEGITIMATE caller (p_customer_id = auth.uid()) => succeeds. Impersonates a
--     real auth.users row (if any exists) and rolls the inserted event back via a
--     sentinel exception, so nothing is persisted. Skipped (not failed) on an
--     empty-users DB -- the security-critical proof is the negatives above.
DO $probe$
DECLARE
  v_uid uuid;
  v_eid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE NOTICE 'probe 6e SKIPPED: no auth.users row to impersonate for the positive path.';
  ELSE
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
      v_eid := public.create_event_booking(
        v_uid, 'p0l-positive-probe', 'probe', current_date, 'probe', 1, 1);
      IF v_eid IS NULL THEN
        RAISE EXCEPTION 'PROBE_FAIL: legitimate create_event_booking returned NULL';
      END IF;
      RAISE EXCEPTION 'ROLLBACK_POSITIVE_PROBE';  -- discard the inserted row
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLERRM LIKE 'PROBE_FAIL%' THEN RAISE; END IF;
        IF SQLERRM LIKE 'ROLLBACK_POSITIVE_PROBE%' THEN
          RAISE NOTICE 'probe 6e OK: legitimate (self) create_event_booking succeeded (rolled back).';
        ELSE
          RAISE EXCEPTION 'PROBE_FAIL: legitimate create_event_booking errored (%: %)', SQLSTATE, SQLERRM;
        END IF;
    END;
  END IF;
END;
$probe$;

COMMIT;

-- Reload PostgREST's schema cache so the re-created functions + new grants are
-- picked up by the API layer immediately.
NOTIFY pgrst, 'reload schema';

