-- 20261222000000_mehendi_booking_accept_authoritative.sql
--
-- P0-1 (mehendi category), STEP 2: move booking ACCEPT financial authority off
-- the browser.
--
-- BEFORE: src/pages/vendor/VendorBookings.tsx computed the advance in the
--   browser on accept (mehendi flowed through the generic else branch):
--       total     = Number(booking.amount ?? booking.total_amount ?? 0)  // client-loaded
--       advance   = Math.round(total * 0.2)   // FLAT 20%
--       remaining = total - advance
--   and PATCHed mehendi_bookings.advance_amount / remaining_amount with those
--   client numbers. A tampered client could accept with any advance/remaining.
--   That generic flat-20% recompute ALSO overwrote the advance rate MehendiMenu
--   derives for the customer from the package's advance_percentage
--   (Number(pkg.advance_percentage || 20)) — a latent inconsistency this RPC
--   removes so the accepted advance matches what the customer was shown.
--
-- AFTER: the vendor calls public.accept_mehendi_booking(p_booking_id). This
--   SECURITY DEFINER RPC re-derives the advance from the STORED, authoritative
--   total_amount using the package's authoritative advance_percentage, verifies
--   the caller actually owns the booking (provider_profiles.user_id = auth.uid()),
--   requires the booking to be pending, and flips it to accepted atomically. No
--   financial value crosses the trust boundary from the browser.
--
-- ADVANCE RULE (preserve business logic — P0-1 Step 7; do not "fix" here):
--   advance   = round(total_amount * advance_percentage / 100)
--   remaining = total_amount - advance
--   KEY MEHENDI DIFFERENCE vs band/anchor/decorator/dj/drone (flat 20%): mehendi's
--   authoritative advance rate is the package's per-package advance_percentage
--   (like dancer/makeup). The package is re-read here via the booking's package_id.
--   The rate mirrors MehendiMenu's Number(pkg.advance_percentage || 20) EXACTLY: a
--   NULL or 0 rate falls back to 20 (coalesce(nullif(advance_percentage, 0), 20)).
--   For rate = 20 (the common case) this is identical to the flat-20% categories.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes of advance_amount / remaining_amount is in
-- supabase/migrations-pending/PHASE_mehendi_bookings_column_lockdown.sql and must
-- NOT be promoted until this RPC + the rewired VendorBookings are live.
--
-- ROLLBACK: DROP FUNCTION public.accept_mehendi_booking(uuid);
--   The old VendorBookings client-PATCH accept path would then have to be
--   restored to keep vendor accepts working; nothing else depends on this.
--
-- Requires: 20261221000000_mehendi_booking_server_authoritative.sql (for the
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
    v_pct_typ text;
BEGIN
    FOR req IN
        SELECT tbl, col FROM (VALUES
            ('mehendi_bookings','id'), ('mehendi_bookings','provider_id'),
            ('mehendi_bookings','package_id'), ('mehendi_bookings','status'),
            ('mehendi_bookings','total_amount'), ('mehendi_bookings','advance_amount'),
            ('mehendi_bookings','remaining_amount'), ('mehendi_bookings','accepted_at'),
            ('mehendi_bookings','payment_deadline'), ('mehendi_bookings','calendar_locked'),
            ('mehendi_packages','id'), ('mehendi_packages','advance_percentage'),
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
        RAISE EXCEPTION 'ABORT accept_mehendi_booking: live schema is missing expected column(s):%', v_missing;
    END IF;

    -- The advance rate must be an integer type (advance_percentage); a drift to
    -- text/float would change how the advance rounds.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_pct_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.mehendi_packages'::regclass
       AND a.attname = 'advance_percentage' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_pct_typ IS NULL OR v_pct_typ NOT LIKE 'integer%' THEN
        RAISE EXCEPTION 'ABORT accept_mehendi_booking: mehendi_packages.advance_percentage is % (expected integer).', v_pct_typ;
    END IF;

    RAISE NOTICE 'OK: mehendi accept schema matches; creating accept_mehendi_booking.';
END $catalog$;
-- ===========================================================================
-- Server-authoritative mehendi booking ACCEPT. The vendor passes ONLY the
-- booking id. Ownership, state and every financial value are decided here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.accept_mehendi_booking(
    p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid       uuid := auth.uid();
    v_bkg       public.mehendi_bookings%rowtype;
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
      FROM public.mehendi_bookings
     WHERE id = p_booking_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not available' USING ERRCODE = 'P0002';
    END IF;

    -- Authorization: the caller must be the provider that owns this booking.
    -- mehendi_bookings.provider_id is a provider_profiles.id; the owning auth user
    -- is provider_profiles.user_id. (Mirrors the P0-2 ownership check.)
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
    -- re-read from the trusted package). Mirrors MehendiMenu's
    -- Number(pkg.advance_percentage || 20): NULL or 0 -> 20. Financials are
    -- derived from the STORED, authoritative total, never the client.
    SELECT coalesce(nullif(dp.advance_percentage, 0), 20) INTO v_pct
      FROM public.mehendi_packages dp
     WHERE dp.id = v_bkg.package_id;
    v_pct       := coalesce(v_pct, 20);
    v_total     := coalesce(v_bkg.total_amount, 0);
    v_advance   := round(v_total * v_pct / 100.0);
    v_remaining := v_total - v_advance;

    UPDATE public.mehendi_bookings SET
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
REVOKE ALL ON FUNCTION public.accept_mehendi_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_mehendi_booking(uuid) TO authenticated;
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
     WHERE n.nspname = 'public' AND p.proname = 'accept_mehendi_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 accept_mehendi_booking overload, found %.', v_cnt;
    END IF;

    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'accept_mehendi_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: accept_mehendi_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: accept_mehendi_booking has no hardened search_path (got %).', v_search;
    END IF;

    v_anon_exec := has_function_privilege('anon', 'public.accept_mehendi_booking(uuid)', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.accept_mehendi_booking(uuid)', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE accept_mehendi_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE accept_mehendi_booking.';
    END IF;

    RAISE NOTICE 'OK: accept_mehendi_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
