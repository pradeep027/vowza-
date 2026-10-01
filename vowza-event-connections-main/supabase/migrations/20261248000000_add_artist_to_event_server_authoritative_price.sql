-- ===========================================================================
-- 20261248000000_add_artist_to_event_server_authoritative_price.sql
--                                                        [P1 — SECURITY FIX]
--
-- THE GAP (documented residual from 20261246000000 / P0-L, FINAL_REPORT §5):
--   public.add_artist_to_event(..., p_price integer) inserted the browser-
--   supplied p_price DIRECTLY into artist_bookings.price. P0-L closed the authz
--   hole (auth + event-ownership) but EXPLICITLY left price as a browser-trusted
--   value-authority gap. Because SECURITY DEFINER bypasses RLS and nothing
--   recomputed the price, a caller who owns an event could attach a real
--   provider at an arbitrary price of their choosing (e.g. 0).
--
-- CALLER TRACE (verified):
--   src/pages/EventPlanning.tsx -> handleSelectArtist sets price = artist.price_min;
--   handleConfirmBooking -> add_artist_to_event({ ..., p_price: artist.price }).
--   artist.price_min originates in src/hooks/useArtists.ts as
--   provider_profiles.price_min (price_min: p.price_min ?? 0). So the
--   AUTHORITATIVE source of this value is public.provider_profiles.price_min for
--   p_provider_id -- never the browser.
--
-- THE FIX (SECURITY FIX; server-authoritative price, additive, non-breaking):
--   CREATE OR REPLACE add_artist_to_event with the SAME signature (the client
--   still passes p_price, so the call site is unchanged), but:
--     * keep the P0-L fail-closed auth.uid() + event-ownership guard;
--     * derive v_price := COALESCE(provider_profiles.price_min, 0) for
--       p_provider_id (fail-closed 42501 if the provider does not exist);
--     * INSERT the SERVER-DERIVED v_price, ignoring p_price entirely;
--     * RAISE NOTICE (audit only, non-fatal) when p_price <> v_price so a tamper
--       attempt is observable without breaking a stale-but-honest client.
--   artist_bookings.price is NOT NULL + INTEGER and provider_profiles.price_min
--   is INTEGER, so COALESCE(...,0) preserves the exact value the honest client
--   would have sent (useArtists maps the same `?? 0`). BEHAVIOR PRESERVATION for
--   every legitimate booking; only a tampered price is neutralized.
--
-- WHY APPLY-PATH (not parked): the honest EventPlanning flow already sends
--   exactly provider_profiles.price_min, so overriding with the same server value
--   changes nothing it does -- only the forbidden (tampered) value is closed. No
--   frontend-first ordering required. Grants are re-asserted (REVOKE PUBLIC/anon;
--   GRANT authenticated, service_role) so the P0-L lock cannot regress on REPLACE.
--
-- PROOF BY EXECUTION: apply-time probes (A) re-assert anon has no EXECUTE and
--   (B) a positive price-override probe that attaches a real provider at a
--   tampered price and asserts the STORED price equals provider_profiles.price_min
--   (rolled back). Skipped cleanly on an empty-data DB.
-- ===========================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.add_artist_to_event(
  p_event_id      UUID,
  p_provider_id   UUID,
  p_provider_name TEXT,
  p_category      TEXT,
  p_price         INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking_id UUID;
  v_uid        UUID := auth.uid();
  v_price      INTEGER;
  v_found      BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'add_artist_to_event: authentication required'
      USING ERRCODE = '42501';
  END IF;

  -- The caller must own the event they are attaching an artist to (P0-L authz).
  IF NOT EXISTS (
    SELECT 1 FROM public.event_bookings
     WHERE id = p_event_id
       AND customer_id = v_uid
  ) THEN
    RAISE EXCEPTION 'add_artist_to_event: event % is not owned by the caller', p_event_id
      USING ERRCODE = '42501';
  END IF;

  -- SERVER-AUTHORITATIVE PRICE: never trust the browser-supplied p_price. The
  -- authoritative price is the booked provider's own price_min.
  SELECT COALESCE(pp.price_min, 0), TRUE
    INTO v_price, v_found
    FROM public.provider_profiles pp
   WHERE pp.id = p_provider_id;

  IF NOT v_found THEN
    RAISE EXCEPTION 'add_artist_to_event: provider % does not exist', p_provider_id
      USING ERRCODE = '42501';
  END IF;

  -- Audit-only (non-fatal): surface a tamper attempt without rejecting a stale
  -- but honest client. The server value is authoritative regardless.
  IF p_price IS DISTINCT FROM v_price THEN
    RAISE NOTICE 'add_artist_to_event: ignoring browser price % for provider %; using authoritative %',
      p_price, p_provider_id, v_price;
  END IF;

  INSERT INTO public.artist_bookings (
    event_id, provider_id, provider_name, category, price
  ) VALUES (
    p_event_id, p_provider_id, p_provider_name, p_category, v_price
  ) RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

-- Re-assert the P0-L grant lock (CREATE OR REPLACE must not reopen anon EXECUTE).
REVOKE ALL ON FUNCTION public.add_artist_to_event(uuid, uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_artist_to_event(uuid, uuid, text, text, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Catalog assertion: the P0-L lock survived CREATE OR REPLACE.
-- ---------------------------------------------------------------------------
DO $assert$
DECLARE
  v_oid oid := 'public.add_artist_to_event(uuid, uuid, text, text, integer)'::regprocedure::oid;
BEGIN
  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'add_artist price-fix assert FAILED: anon still has EXECUTE';
  END IF;
  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'add_artist price-fix assert FAILED: authenticated lacks EXECUTE';
  END IF;
  RAISE NOTICE 'add_artist price-fix catalog assert OK: anon has no EXECUTE; authenticated does.';
END;
$assert$;

-- Probe A: ANON -> add_artist_to_event => denied at the EXECUTE grant.
DO $probe$
BEGIN
  SET LOCAL ROLE anon;
  PERFORM public.add_artist_to_event(
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    'probe', 'probe', 1);
  RAISE EXCEPTION 'PROBE_FAIL: anon add_artist_to_event was NOT rejected';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'probe A OK: anon add_artist_to_event rejected (42501).';
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'PROBE_FAIL%' THEN RAISE; END IF;
    RAISE NOTICE 'probe A OK: anon add_artist_to_event rejected (%: %).', SQLSTATE, SQLERRM;
END;
$probe$;

-- Probe B: POSITIVE price-override. A legitimate event-owner attaches a REAL
-- provider at a tampered price; assert the STORED price equals the provider's
-- authoritative price_min, not the browser value. Impersonates a real auth.users
-- row + a real provider_profiles row; rolled back via a sentinel exception.
-- Skipped (not failed) when the DB has no users/providers to drive it.
DO $probe$
DECLARE
  v_uid    uuid;
  v_pid    uuid;
  v_pmin   integer;
  v_eid    uuid;
  v_bid    uuid;
  v_tamper integer;
  v_stored integer;
BEGIN
  SELECT id INTO v_uid FROM auth.users LIMIT 1;
  SELECT id, COALESCE(price_min, 0) INTO v_pid, v_pmin FROM public.provider_profiles LIMIT 1;
  IF v_uid IS NULL OR v_pid IS NULL THEN
    RAISE NOTICE 'probe B SKIPPED: need >=1 auth.users and >=1 provider_profiles row to prove price authority.';
    RETURN;
  END IF;
  v_tamper := v_pmin + 1000000;  -- guaranteed != the authoritative price
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
    v_eid := public.create_event_booking(
      v_uid, 'price-probe', 'probe', current_date, 'probe', 1, 1);
    v_bid := public.add_artist_to_event(
      v_eid, v_pid, 'price-probe', 'probe', v_tamper);
    -- Read back as the owner (bypass RLS) so the assertion sees the real row.
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);
    SELECT price INTO v_stored FROM public.artist_bookings WHERE id = v_bid;
    IF v_stored IS DISTINCT FROM v_pmin THEN
      RAISE EXCEPTION 'PROBE_FAIL: stored price % != authoritative price_min % (browser p_price % leaked)',
        v_stored, v_pmin, v_tamper;
    END IF;
    RAISE EXCEPTION 'ROLLBACK_POSITIVE_PROBE';  -- discard the probe rows
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'PROBE_FAIL%' THEN RAISE; END IF;
      IF SQLERRM LIKE 'ROLLBACK_POSITIVE_PROBE%' THEN
        RAISE NOTICE 'probe B OK: tampered price neutralized; stored price = provider_profiles.price_min (rolled back).';
      ELSE
        RAISE EXCEPTION 'PROBE_FAIL: price-override probe errored (%: %)', SQLSTATE, SQLERRM;
      END IF;
  END;
END;
$probe$;

COMMIT;

-- Reload PostgREST's schema cache so the re-created function is picked up.
NOTIFY pgrst, 'reload schema';
