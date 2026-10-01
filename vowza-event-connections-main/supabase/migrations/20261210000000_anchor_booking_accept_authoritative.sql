-- 20261210000000_anchor_booking_accept_authoritative.sql
--
-- P0-1 (anchor category), STEP 2: move booking ACCEPT financial authority off
-- the browser.
--
-- BEFORE: src/pages/vendor/VendorBookings.tsx computed the advance in the
--   browser on accept (anchor flowed through the generic else branch):
--       total     = Number(booking.amount ?? booking.total_amount ?? 0)  // client-loaded
--       advance   = Math.round(total * 0.2)
--       remaining = total - advance
--   and PATCHed anchor_bookings.advance_amount / remaining_amount with those
--   client numbers. A tampered client could accept with any advance/remaining.
--
-- AFTER: the vendor calls public.accept_anchor_booking(p_booking_id). This
--   SECURITY DEFINER RPC re-derives the advance from the STORED, authoritative
--   total_amount (written at creation by create_anchor_booking), verifies the
--   caller actually owns the booking (provider_profiles.user_id = auth.uid()),
--   requires the booking to be pending, and flips it to accepted atomically.
--   No financial value crosses the trust boundary from the browser.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes of advance_amount / remaining_amount is in
-- supabase/migrations-pending/PHASE_anchor_bookings_column_lockdown.sql and must
-- NOT be promoted until this RPC + the rewired VendorBookings are live.
--
-- ADVANCE RULE (preserve business logic — P0-1 Step 4; do not "fix" here):
--   advance   = round(total_amount * 20 / 100)   -- flat 20%, matching the old
--                                                    accept path (the generic
--                                                    else branch used
--                                                    Math.round(total * 0.2)).
--   remaining = total_amount - advance
--   The AnchorMenu confirm screen DISPLAYS advance at the package's
--   advance_percentage (null/0 -> 20), but no advance is stored until accept;
--   the stored advance is this flat 20%. Reconciling the display % with the
--   accept % is a documented deferred item, NOT a tamper hole once both the
--   creation and accept amounts are server-derived.
--
-- ROLLBACK: DROP FUNCTION public.accept_anchor_booking(uuid);
--   The old VendorBookings client-PATCH accept path would then have to be
--   restored to keep vendor accepts working; nothing else depends on this.
--
-- Requires: 20261209000000_anchor_booking_server_authoritative.sql (for the
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
            ('anchor_bookings','id'), ('anchor_bookings','provider_id'),
            ('anchor_bookings','status'), ('anchor_bookings','total_amount'),
            ('anchor_bookings','advance_amount'), ('anchor_bookings','remaining_amount'),
            ('anchor_bookings','accepted_at'), ('anchor_bookings','payment_deadline'),
            ('anchor_bookings','calendar_locked'),
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
        RAISE EXCEPTION 'ABORT accept_anchor_booking: live schema is missing expected column(s):%', v_missing;
    END IF;

    RAISE NOTICE 'OK: anchor accept schema matches; creating accept_anchor_booking.';
END $catalog$;
-- ===========================================================================
-- Server-authoritative anchor booking ACCEPT. The vendor passes ONLY the
-- booking id. Ownership, state and every financial value are decided here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.accept_anchor_booking(
    p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid       uuid := auth.uid();
    v_bkg       public.anchor_bookings%rowtype;
    v_owner_uid uuid;
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
      FROM public.anchor_bookings
     WHERE id = p_booking_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not available' USING ERRCODE = 'P0002';
    END IF;

    -- Authorization: the caller must be the provider that owns this booking.
    -- anchor_bookings.provider_id is a provider_profiles.id; the owning auth user
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

    -- Financials — derived from the STORED, authoritative total, never the client.
    v_total     := coalesce(v_bkg.total_amount, 0);
    v_advance   := round(v_total * 20 / 100.0);
    v_remaining := v_total - v_advance;

    UPDATE public.anchor_bookings SET
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
REVOKE ALL ON FUNCTION public.accept_anchor_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_anchor_booking(uuid) TO authenticated;
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
     WHERE n.nspname = 'public' AND p.proname = 'accept_anchor_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 accept_anchor_booking overload, found %.', v_cnt;
    END IF;

    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'accept_anchor_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: accept_anchor_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: accept_anchor_booking has no hardened search_path (got %).', v_search;
    END IF;

    v_anon_exec := has_function_privilege('anon', 'public.accept_anchor_booking(uuid)', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.accept_anchor_booking(uuid)', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE accept_anchor_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE accept_anchor_booking.';
    END IF;

    RAISE NOTICE 'OK: accept_anchor_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
