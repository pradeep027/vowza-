-- 20261208000000_catering_booking_accept_authoritative.sql
--
-- P0-1 (catering category): make the vendor ACCEPT step server-authoritative.
-- Companion to 20261207000000_catering_booking_server_authoritative.sql. Mirrors
-- the band accept pilot (20261206000000) exactly; catering's accept economics are
-- identical to band's (flat 20% advance of the STORED total), so no formula is
-- adapted here beyond the table name.
--
-- BEFORE: src/pages/vendor/VendorBookings.tsx accepted a catering booking by
--   PATCHing catering_bookings directly, computing advance_amount =
--   round(total * 0.2) and remaining_amount = total - advance in the BROWSER and
--   writing both. A tampered vendor client could persist any advance/remaining.
--
-- AFTER: the vendor client calls public.accept_catering_booking(p_booking_id).
--   This SECURITY DEFINER RPC re-derives advance/remaining from the STORED
--   total_amount (never a client number), verifies the caller is the owning
--   provider, requires status = 'pending', and flips the row to 'accepted'
--   atomically. No financial value crosses the trust boundary at accept time.
--
-- Advance rule reproduced EXACTLY from VendorBookings.tsx (Math.round(total*0.2)):
--   advance   = round(total_amount * 20 / 100)
--   remaining = total_amount - advance
-- The catering_packages.advance_percentage column is deliberately NOT consulted:
-- the current UI applies a flat 20% at accept, and Rule 10 says reproduce, not
-- "fix", the existing business rule.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It revokes nothing.
--
-- ROLLBACK: DROP FUNCTION public.accept_catering_booking(uuid);
--   The old VendorBookings direct-PATCH accept path would then have to be
--   restored; nothing else depends on this function.

BEGIN;

-- =============================================================================
-- SCHEMA DRIFT GUARD. Fails the whole migration if the live schema is not what
-- accept_catering_booking reads and writes, so the accept RPC can never derive
-- advance/remaining against columns that moved or changed numeric type.
-- =============================================================================
DO $catalog$
DECLARE
    -- catering_bookings columns accept reads or writes
    need_bookings text[] := ARRAY[
        'id','provider_id','status','total_amount','advance_amount',
        'remaining_amount','accepted_at','payment_deadline','calendar_locked'
    ];
    -- provider_profiles columns used to authorize the caller
    need_profiles text[] := ARRAY['id','user_id'];
    numeric_cols  text[] := ARRAY['total_amount','advance_amount','remaining_amount'];
    c       text;
    v_type  text;
BEGIN
    FOREACH c IN ARRAY need_bookings LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute
             WHERE attrelid = 'public.catering_bookings'::regclass
               AND attname = c AND attnum > 0 AND NOT attisdropped
        ) THEN
            RAISE EXCEPTION 'ABORT accept_catering_booking: catering_bookings.% is missing.', c;
        END IF;
    END LOOP;

    FOREACH c IN ARRAY need_profiles LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute
             WHERE attrelid = 'public.provider_profiles'::regclass
               AND attname = c AND attnum > 0 AND NOT attisdropped
        ) THEN
            RAISE EXCEPTION 'ABORT accept_catering_booking: provider_profiles.% is missing.', c;
        END IF;
    END LOOP;

    FOREACH c IN ARRAY numeric_cols LOOP
        SELECT t.typname INTO v_type
          FROM pg_attribute a
          JOIN pg_type t ON t.oid = a.atttypid
         WHERE a.attrelid = 'public.catering_bookings'::regclass AND a.attname = c;
        IF v_type NOT IN ('int2','int4','int8','numeric','float4','float8') THEN
            RAISE EXCEPTION 'ABORT accept_catering_booking: catering_bookings.% is % (expected numeric).', c, v_type;
        END IF;
    END LOOP;
END $catalog$;

CREATE OR REPLACE FUNCTION public.accept_catering_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid        uuid := auth.uid();
    v_bkg        public.catering_bookings%ROWTYPE;
    v_owner_uid  uuid;
    v_total      numeric;
    v_advance    numeric;
    v_remaining  numeric;
    v_deadline   timestamptz := now() + interval '24 hours';
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
    END IF;

    -- Lock the booking row for the duration of the accept.
    SELECT * INTO v_bkg
      FROM public.catering_bookings
     WHERE id = p_booking_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Catering booking not found' USING ERRCODE = '22023';
    END IF;

    -- Authorization: only the provider that OWNS this booking may accept it.
    -- booking.provider_id -> provider_profiles.id -> provider_profiles.user_id.
    SELECT pp.user_id INTO v_owner_uid
      FROM public.provider_profiles pp
     WHERE pp.id = v_bkg.provider_id;

    IF v_owner_uid IS NULL OR v_owner_uid <> v_uid THEN
        RAISE EXCEPTION 'Only the booking provider may accept this booking' USING ERRCODE = '42501';
    END IF;

    -- Only a pending booking can be accepted (mirrors the client status gate).
    IF v_bkg.status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'Booking is not pending (status = %)', v_bkg.status USING ERRCODE = '22023';
    END IF;

    -- Re-derive advance/remaining from the STORED total, never a client number.
    -- Flat 20% — reproduces VendorBookings.tsx Math.round(total * 0.2).
    v_total     := coalesce(v_bkg.total_amount, 0);
    v_advance   := round(v_total * 20 / 100.0);
    v_remaining := v_total - v_advance;

    UPDATE public.catering_bookings
       SET status           = 'accepted',
           accepted_at      = now(),
           advance_amount   = v_advance,
           remaining_amount = v_remaining,
           payment_deadline = v_deadline,
           calendar_locked  = false
     WHERE id = p_booking_id;

    RETURN jsonb_build_object(
        'booking_id',       p_booking_id,
        'status',           'accepted',
        'total_amount',     v_total,
        'advance_amount',   v_advance,
        'remaining_amount', v_remaining,
        'payment_deadline', v_deadline
    );
END;
$fn$;

-- Only a signed-in user may accept. anon / public can never call it; the
-- provider-ownership check inside the function is the real authorization gate.
REVOKE ALL ON FUNCTION public.accept_catering_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_catering_booking(uuid) TO authenticated;

-- Fail-closed self-check: exactly one overload, SECURITY DEFINER, empty
-- search_path, callable by authenticated only and never by anon.
DO $verify$
DECLARE
    v_count int;
    v_oid   oid;
    v_sec   boolean;
    v_cfg   text[];
BEGIN
    SELECT count(*) INTO v_count
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'accept_catering_booking';
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'ABORT accept_catering_booking: expected exactly 1 overload, found %.', v_count;
    END IF;

    SELECT p.oid, p.prosecdef, p.proconfig INTO v_oid, v_sec, v_cfg
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'accept_catering_booking';

    IF NOT v_sec THEN
        RAISE EXCEPTION 'ABORT accept_catering_booking: function is not SECURITY DEFINER.';
    END IF;
    -- A hardened `SET search_path = ''` is serialized into proconfig QUOTED, as
    -- the element `search_path=""` (empty value), NOT the bare `search_path=`, so
    -- an exact array-equality check false-aborts. Assert a pinned search_path
    -- entry exists (tolerant of the quoted-empty form) — the same posture every
    -- other category self-check verifies via `proconfig LIKE '%search_path=%'`.
    IF v_cfg IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(v_cfg) AS s WHERE s LIKE 'search_path=%'
    ) THEN
        RAISE EXCEPTION 'ABORT accept_catering_booking: search_path is not pinned (proconfig=%).', v_cfg;
    END IF;
    IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'ABORT accept_catering_booking: anon can EXECUTE (must be authenticated only).';
    END IF;
    IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'ABORT accept_catering_booking: authenticated cannot EXECUTE.';
    END IF;

    RAISE NOTICE 'OK: accept_catering_booking is SECURITY DEFINER, search_path locked, authenticated-only.';
END $verify$;

COMMIT;

-- PostgREST caches the schema; without this the new RPC is not callable until the
-- next DDL event.
NOTIFY pgrst, 'reload schema';



