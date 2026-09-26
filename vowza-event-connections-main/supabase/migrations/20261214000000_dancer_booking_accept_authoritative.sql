-- 20261214000000_dancer_booking_accept_authoritative.sql
--
-- P0-1 (dancer category), STEP 2: move booking ACCEPT financial authority off
-- the browser.
--
-- BEFORE: src/pages/vendor/VendorBookings.tsx computed the advance in the
--   browser on accept (dancer flowed through the generic else branch):
--       total     = Number(booking.amount ?? booking.total_amount ?? 0)  // client-loaded
--       advance   = Math.round(total * 0.2)
--       remaining = total - advance
--   and PATCHed dancer_bookings.advance_amount / remaining_amount with those
--   client numbers. A tampered client could accept with any advance/remaining.
--   That generic flat-20% recompute ALSO overwrote the creation-time advance,
--   which DancerMenu derives from the package's advance_percentage — a latent
--   inconsistency this RPC removes.
--
-- AFTER: the vendor calls public.accept_dancer_booking(p_booking_id). This
--   SECURITY DEFINER RPC re-derives the advance from the STORED, authoritative
--   total_amount (written at creation by create_dancer_booking) using the
--   package's authoritative advance_percentage, verifies the caller actually
--   owns the booking (provider_profiles.user_id = auth.uid()), requires the
--   booking to be pending, and flips it to accepted atomically. No financial
--   value crosses the trust boundary from the browser.
--
-- ADVANCE RULE (preserve business logic — P0-1 Step 7; do not "fix" here):
--   advance   = round(total_amount * advance_percentage / 100)
--   remaining = total_amount - advance
--   KEY DANCER DIFFERENCE vs band/anchor/decorator (which store a flat 20%):
--   dancer's authoritative advance rate is the package's per-package
--   advance_percentage column (integer NOT NULL DEFAULT 20). The package is
--   re-read here via the booking's package_id; in the normal flow this equals
--   the advance create_dancer_booking already stored. For advance_percentage=20
--   (the schema default) this is identical to the flat-20% categories.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes of advance_amount / remaining_amount is in
-- supabase/migrations-pending/PHASE_dancer_bookings_column_lockdown.sql and
-- must NOT be promoted until this RPC + the rewired VendorBookings are live.
--
-- ROLLBACK: DROP FUNCTION public.accept_dancer_booking(uuid);
--   The old VendorBookings client-PATCH accept path would then have to be
--   restored to keep vendor accepts working; nothing else depends on this.
--
-- Requires: 20261213000000_dancer_booking_server_authoritative.sql (for the
--   authoritative total_amount this RPC reads).

BEGIN;

-- ===========================================================================
-- FAIL-CLOSED DRIFT GUARD. Abort (rolling back the migration) if the columns
-- this RPC reads/writes are not exactly what the repo snapshot assumes.
-- ===========================================================================
DO $catalog$
DECLARE
    req       record;
    v_missing text := '';
BEGIN
    FOR req IN
        SELECT tbl, col FROM (VALUES
            ('dancer_bookings','id'), ('dancer_bookings','provider_id'),
            ('dancer_bookings','package_id'), ('dancer_bookings','status'),
            ('dancer_bookings','total_amount'), ('dancer_bookings','advance_amount'),
            ('dancer_bookings','remaining_amount'), ('dancer_bookings','accepted_at'),
            ('dancer_bookings','payment_deadline'), ('dancer_bookings','calendar_locked'),
            ('dancer_packages','id'), ('dancer_packages','advance_percentage'),
            ('provider_profiles','id'), ('provider_profiles','user_id')
        ) AS t(tbl, col)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute a
             WHERE a.attrelid = ('public.' || req.tbl)::regclass
               AND a.attname = req.col AND a.attnum > 0 AND NOT a.attisdropped
        ) THEN
            v_missing := v_missing || format(' %s.%s', req.tbl, req.col);
        END IF;
    END LOOP;
    IF v_missing <> '' THEN
        RAISE EXCEPTION 'ABORT accept_dancer_booking: live schema is missing expected column(s):%', v_missing;
    END IF;

    RAISE NOTICE 'OK: dancer accept schema matches; creating accept_dancer_booking.';
END $catalog$;
-- ===========================================================================
-- Server-authoritative dancer booking ACCEPT. The vendor passes ONLY the
-- booking id. Ownership, state and every financial value are decided here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.accept_dancer_booking(
    p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid       uuid := auth.uid();
    v_bkg       public.dancer_bookings%rowtype;
    v_owner_uid uuid;
    v_pct       integer;
    v_total     numeric;
    v_advance   numeric;
    v_remaining numeric;
    v_now       timestamptz := now();
    v_deadline  timestamptz := now() + interval '24 hours';
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
    END IF;
    -- Row-lock the booking so its status/total cannot change under us.
    SELECT * INTO v_bkg
      FROM public.dancer_bookings
     WHERE id = p_booking_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not available' USING ERRCODE = 'P0002';
    END IF;

    -- Authorization: the caller must be the provider that owns this booking.
    -- dancer_bookings.provider_id is a provider_profiles.id; the owning auth
    -- user is provider_profiles.user_id. (Mirrors the P0-2 ownership check.)
    SELECT pp.user_id INTO v_owner_uid
      FROM public.provider_profiles pp
     WHERE pp.id = v_bkg.provider_id;
    IF v_owner_uid IS NULL OR v_owner_uid <> v_uid THEN
        RAISE EXCEPTION 'Only the booking provider may accept this booking'
            USING ERRCODE = '42501';
    END IF;

    -- Only a pending booking can be accepted (idempotent, no double-accept).
    IF v_bkg.status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'Only a pending booking can be accepted (current status: %)', v_bkg.status
            USING ERRCODE = '22023';
    END IF;

    -- Advance rate = the booking's package advance_percentage (authoritative,
    -- re-read from the trusted package; NOT NULL DEFAULT 20). Financials are
    -- derived from the STORED, authoritative total, never the client.
    SELECT coalesce(dp.advance_percentage, 20) INTO v_pct
      FROM public.dancer_packages dp
     WHERE dp.id = v_bkg.package_id;
    v_pct       := coalesce(v_pct, 20);
    v_total     := coalesce(v_bkg.total_amount, 0);
    v_advance   := round(v_total * v_pct / 100.0);
    v_remaining := v_total - v_advance;

    UPDATE public.dancer_bookings SET
        status           = 'accepted',
        accepted_at      = v_now,
        advance_amount   = v_advance,
        remaining_amount = v_remaining,
        payment_deadline = v_deadline,
        calendar_locked  = false
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
        'success',          true,
        'booking_id',       p_booking_id,
        'status',           'accepted',
        'advance_amount',   v_advance,
        'remaining_amount', v_remaining,
        'payment_deadline', v_deadline
    );
END $fn$;

-- Callable only by signed-in users; never anon/public. The RPC itself enforces
-- that the caller is the owning provider.
REVOKE ALL ON FUNCTION public.accept_dancer_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_dancer_booking(uuid) TO authenticated;
-- ===========================================================================
-- FAIL-CLOSED SELF-CHECK. Prove the function landed exactly as intended.
-- ===========================================================================
DO $verify$
DECLARE
    v_cnt        int;
    v_secdef     boolean;
    v_search     text;
    v_anon_exec  boolean;
    v_auth_exec  boolean;
BEGIN
    SELECT count(*) INTO v_cnt
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'accept_dancer_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 accept_dancer_booking overload, found %.', v_cnt;
    END IF;

    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'accept_dancer_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: accept_dancer_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: accept_dancer_booking has no hardened search_path (got %).', v_search;
    END IF;

    v_anon_exec := has_function_privilege('anon', 'public.accept_dancer_booking(uuid)', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.accept_dancer_booking(uuid)', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE accept_dancer_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE accept_dancer_booking.';
    END IF;

    RAISE NOTICE 'OK: accept_dancer_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
