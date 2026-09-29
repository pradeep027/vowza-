-- 20261230000000_videography_booking_accept_authoritative.sql
--
-- P0-1 (videography category): move booking ACCEPTANCE financial authority off
-- the browser.
--
-- BEFORE: src/pages/vendor/VendorBookings.tsx accepted a videography booking
--   through the generic `else` branch, which client-side PATCHed the row with
--   advance_amount = Math.round(total * 0.2) and remaining_amount = total -
--   advance — a FLAT 20% computed in the browser and trusted by the DB. That
--   both (a) let a tampered client PATCH any advance/remaining, and (b) used a
--   flat 20% instead of the package's advance_percentage that create_videography_
--   booking honors, so an accepted booking could disagree with its own creation.
--
-- AFTER: the browser calls public.accept_videography_booking(p_booking_id). This
--   SECURITY DEFINER RPC verifies the caller OWNS the booking's provider, then
--   re-derives the advance from the STORED total_amount HONORING the package's
--   advance_percentage — never a browser value. It returns the derived amounts
--   as jsonb so the UI can show the correct advance without being trusted for it.
--
-- Advance rate (P0-1 — preserve business logic): advance = round(stored
--   total_amount * advance_percentage / 100), advance_percentage from the
--   videography_packages row, NULL or 0 -> 20. This mirrors create_videography_
--   booking so create and accept never disagree.
--
-- This migration is ADDITIVE and safe on its own: it only creates a function and
-- grants EXECUTE. The direct-PATCH lockdown is parked separately at
-- supabase/migrations-pending/PHASE_videography_bookings_column_lockdown.sql.
--
-- ROLLBACK:
--   DROP FUNCTION public.accept_videography_booking(uuid);
--   Then VendorBookings.tsx must fall back to the generic client PATCH branch.
BEGIN;
-- ---------------------------------------------------------------------------
-- Fail-closed pre-flight: abort if the columns this RPC reads/writes are missing
-- or the wrong type. advance_percentage must be integer (matches create).
-- ---------------------------------------------------------------------------
DO $catalog$
DECLARE
  v_missing text;
  v_pct_type text;
BEGIN
  -- provider_profiles must expose id + user_id for the ownership check.
  SELECT string_agg(needed.col, ', ')
    INTO v_missing
  FROM (VALUES ('id'), ('user_id')) AS needed(col)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.provider_profiles'::regclass
      AND a.attname = needed.col
      AND a.attnum > 0
      AND NOT a.attisdropped
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'provider_profiles missing column(s): %', v_missing;
  END IF;

  -- videography_bookings columns this RPC reads/writes.
  SELECT string_agg(needed.col, ', ')
    INTO v_missing
  FROM (VALUES ('id'), ('provider_id'), ('package_id'), ('status'),
               ('total_amount'), ('advance_amount'), ('remaining_amount'),
               ('accepted_at'), ('payment_deadline'), ('calendar_locked')) AS needed(col)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.videography_bookings'::regclass
      AND a.attname = needed.col
      AND a.attnum > 0
      AND NOT a.attisdropped
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'videography_bookings missing column(s): %', v_missing;
  END IF;

  -- videography_packages.advance_percentage feeds the re-derived advance.
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_pct_type
    FROM pg_attribute a
   WHERE a.attrelid = 'public.videography_packages'::regclass
     AND a.attname = 'advance_percentage';
  IF v_pct_type IS NULL THEN
    RAISE EXCEPTION 'videography_packages.advance_percentage is missing';
  END IF;
  IF v_pct_type NOT LIKE 'integer%' THEN
    RAISE EXCEPTION 'videography_packages.advance_percentage is % (expected integer)', v_pct_type;
  END IF;
END
$catalog$;
-- ---------------------------------------------------------------------------
-- accept_videography_booking: the ONLY authorized way for a provider to accept a
-- pending videography booking. Verifies ownership, re-derives the advance from
-- the STORED total, and returns the derived amounts as jsonb.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_videography_booking(
  p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_bkg public.videography_bookings%ROWTYPE;
  v_owner_uid uuid;
  v_pct integer;
  v_total numeric(12,2);
  v_advance numeric(12,2);
  v_remaining numeric(12,2);
  v_deadline timestamptz;
BEGIN
  -- 1. Authentication.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '28000';
  END IF;

  -- 2. Load + lock the booking.
  SELECT * INTO v_bkg
    FROM public.videography_bookings
   WHERE id = p_booking_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Videography booking % not found', p_booking_id
      USING errcode = 'P0002';
  END IF;

  -- 3. Ownership: provider_id -> provider_profiles.id -> user_id = auth.uid().
  SELECT pp.user_id INTO v_owner_uid
    FROM public.provider_profiles pp
   WHERE pp.id = v_bkg.provider_id;
  IF v_owner_uid IS NULL OR v_owner_uid <> v_uid THEN
    RAISE EXCEPTION 'Not authorized to accept booking %', p_booking_id
      USING errcode = '42501';
  END IF;

  -- 4. Only a pending booking may be accepted.
  IF v_bkg.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Videography booking % is not pending (status=%)',
      p_booking_id, v_bkg.status USING errcode = 'P0002';
  END IF;
  -- 5. Re-derive the advance from the STORED total HONORING advance_percentage.
  --    The browser's advance is never trusted. NULL or 0 pct -> 20.
  SELECT coalesce(nullif(dp.advance_percentage, 0), 20) INTO v_pct
    FROM public.videography_packages dp
   WHERE dp.id = v_bkg.package_id;
  v_pct := coalesce(v_pct, 20);
  v_total := coalesce(v_bkg.total_amount, 0);
  v_advance := round(v_total * v_pct / 100.0);
  v_remaining := v_total - v_advance;
  v_deadline := now() + interval '24 hours';

  -- 6. Commit the acceptance. Only benign lifecycle columns + the re-derived
  --    advance/remaining are written; base/total are never touched here.
  UPDATE public.videography_bookings
     SET status = 'accepted',
         accepted_at = now(),
         advance_amount = v_advance,
         remaining_amount = v_remaining,
         payment_deadline = v_deadline,
         calendar_locked = false
   WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'status', 'accepted',
    'advance_amount', v_advance,
    'remaining_amount', v_remaining,
    'payment_deadline', v_deadline
  );
END
$fn$;

-- ---------------------------------------------------------------------------
-- Least privilege: only authenticated providers may call this.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.accept_videography_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_videography_booking(uuid) TO authenticated;
-- ---------------------------------------------------------------------------
-- Fail-closed post-conditions.
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
  v_count integer;
  v_secdef boolean;
  v_config text[];
  v_anon boolean;
  v_auth boolean;
BEGIN
  SELECT count(*), bool_and(p.prosecdef)
    INTO v_count, v_secdef
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'accept_videography_booking';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 accept_videography_booking, found %', v_count;
  END IF;
  IF NOT v_secdef THEN
    RAISE EXCEPTION 'accept_videography_booking is not SECURITY DEFINER';
  END IF;

  SELECT p.proconfig INTO v_config
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'accept_videography_booking';
  IF v_config IS NULL OR NOT (array_to_string(v_config, ',') LIKE '%search_path=%') THEN
    RAISE EXCEPTION 'accept_videography_booking has no pinned search_path';
  END IF;

  v_anon := has_function_privilege('anon',
    'public.accept_videography_booking(uuid)', 'EXECUTE');
  v_auth := has_function_privilege('authenticated',
    'public.accept_videography_booking(uuid)', 'EXECUTE');
  IF v_anon THEN
    RAISE EXCEPTION 'anon must NOT execute accept_videography_booking';
  END IF;
  IF NOT v_auth THEN
    RAISE EXCEPTION 'authenticated must execute accept_videography_booking';
  END IF;
END
$verify$;

COMMIT;

-- Reload PostgREST so the new RPC is exposed immediately.
NOTIFY pgrst, 'reload schema';
