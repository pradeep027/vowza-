-- 20261234000000_banquet_booking_accept_authoritative.sql
--
-- P0-1 (banquet category): server-authoritative ACCEPT.
--
-- BEFORE: src/pages/vendor/VendorBookings.tsx accepted a banquet booking by
--   PATCHing banquet_bookings directly (the generic else branch) — setting
--   status='accepted', and writing advance_amount / remaining_amount recomputed
--   IN THE BROWSER (Math.round(total * 0.2), a flat 20%). A tampered vendor client
--   could PATCH any advance/remaining, or accept a booking it does not own
--   (row-level RLS alone cannot re-derive the money). The flat 20% also
--   disagreed with the hall's advance_percentage that BanquetHallMenu HONORS.
--
-- AFTER: the vendor client calls public.accept_banquet_booking(p_booking_id).
--   This SECURITY DEFINER RPC verifies the caller OWNS the booking's provider
--   profile (provider_profiles.user_id = auth.uid()), requires status='pending',
--   and RE-DERIVES the advance from the STORED total_amount using the hall's
--   authoritative advance_percentage — never a client value.
--
-- BANQUET re-derivation (HONOR advance_percentage — matches dancer/makeup/mehendi/
-- priest/rental/singer/videography/water, NOT a flat 20%): advance =
--   round(total_amount * pct / 100) where
--   pct = coalesce(nullif(banquet_halls.advance_percentage, 0), 20)  -- NULL or
--   0 -> 20, mirroring BanquetHallMenu's Number(pkg.advance_percentage || 20).
-- remaining = total_amount - advance. Banquet already STORES advance/remaining at
-- creation, so accept RE-CONFIRMS them from the trusted total (idempotent for an
-- untampered row) and additionally advances the state (status/accepted_at/
-- payment_deadline).
--
-- ADDITIVE and safe to apply alone: creates a function + grants EXECUTE only.
--
-- ROLLBACK: DROP FUNCTION public.accept_banquet_booking(uuid);
BEGIN;

-- ===========================================================================
-- FAIL-CLOSED DRIFT GUARD. Abort if the columns/types this RPC reads and writes
-- are not exactly what the repo snapshot assumes. Uses pg_attribute, not repo.
-- ===========================================================================
DO $catalog$
DECLARE
    req       record;
    v_missing text := '';
    v_pct_typ text;
BEGIN
    FOR req IN
        SELECT tbl, col FROM (VALUES
            ('banquet_bookings','id'), ('banquet_bookings','provider_id'),
            ('banquet_bookings','package_id'), ('banquet_bookings','status'),
            ('banquet_bookings','total_amount'), ('banquet_bookings','advance_amount'),
            ('banquet_bookings','remaining_amount'), ('banquet_bookings','accepted_at'),
            ('banquet_bookings','payment_deadline'), ('banquet_bookings','calendar_locked'),
            ('banquet_halls','id'), ('banquet_halls','advance_percentage'),
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
        RAISE EXCEPTION 'ABORT accept_banquet_booking: live schema is missing expected column(s):%', v_missing;
    END IF;

    -- The advance rate must be an integer type (advance_percentage).
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_pct_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.banquet_halls'::regclass
       AND a.attname = 'advance_percentage' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_pct_typ IS NULL OR v_pct_typ NOT LIKE 'integer%' THEN
        RAISE EXCEPTION 'ABORT accept_banquet_booking: banquet_halls.advance_percentage is % (expected integer).', v_pct_typ;
    END IF;

    RAISE NOTICE 'OK: banquet accept schema matches; creating accept_banquet_booking.';
END $catalog$;
-- ===========================================================================
-- Server-authoritative banquet booking ACCEPT. Vendor passes ONLY the booking
-- id. Ownership is verified server-side; the advance is re-derived from the
-- STORED total using the hall's authoritative advance_percentage.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.accept_banquet_booking(
    p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid       uuid := auth.uid();
    v_bkg       public.banquet_bookings%rowtype;
    v_owner_uid uuid;
    v_pct       integer;
    v_total     numeric;
    v_advance   numeric;
    v_remaining numeric;
    v_deadline  timestamptz;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
    END IF;
    IF p_booking_id IS NULL THEN
        RAISE EXCEPTION 'A booking id is required' USING ERRCODE = '22023';
    END IF;

    -- Row-lock the booking so status/amounts cannot change under us.
    SELECT * INTO v_bkg
      FROM public.banquet_bookings
     WHERE id = p_booking_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0002';
    END IF;

    -- Ownership: the caller must own the booking's provider profile. booking
    -- .provider_id -> provider_profiles.id -> provider_profiles.user_id.
    SELECT pp.user_id INTO v_owner_uid
      FROM public.provider_profiles pp
     WHERE pp.id = v_bkg.provider_id;
    IF v_owner_uid IS NULL OR v_owner_uid <> v_uid THEN
        RAISE EXCEPTION 'Only the booking provider may accept this booking' USING ERRCODE = '42501';
    END IF;
    -- Only a pending booking may be accepted.
    IF v_bkg.status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'Only a pending booking can be accepted (current status: %)', v_bkg.status
            USING ERRCODE = '22023';
    END IF;

    -- Re-derive the advance from the STORED total using the hall's authoritative
    -- advance_percentage (HONOR — matches BanquetHallMenu's
    -- Number(pkg.advance_percentage || 20): NULL or 0 -> 20). Never a client value.
    SELECT coalesce(nullif(dp.advance_percentage, 0), 20) INTO v_pct
      FROM public.banquet_halls dp
     WHERE dp.id = v_bkg.package_id;
    v_pct       := coalesce(v_pct, 20);
    v_total     := coalesce(v_bkg.total_amount, 0);
    v_advance   := round(v_total * v_pct / 100.0);
    v_remaining := v_total - v_advance;
    v_deadline  := now() + interval '24 hours';
    UPDATE public.banquet_bookings
       SET status           = 'accepted',
           accepted_at      = now(),
           advance_amount   = v_advance,
           remaining_amount = v_remaining,
           payment_deadline = v_deadline,
           calendar_locked  = false
     WHERE id = v_bkg.id;

    RETURN jsonb_build_object(
        'success',          true,
        'booking_id',       v_bkg.id,
        'status',           'accepted',
        'advance_amount',   v_advance,
        'remaining_amount', v_remaining,
        'payment_deadline', v_deadline
    );
END $fn$;

-- Callable only by signed-in users; never anon/public. The RPC verifies
-- ownership and re-derives the advance itself.
REVOKE ALL ON FUNCTION public.accept_banquet_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_banquet_booking(uuid) TO authenticated;
-- ===========================================================================
-- FAIL-CLOSED SELF-CHECK.
-- ===========================================================================
DO $verify$
DECLARE
    v_cnt       int;
    v_secdef    boolean;
    v_search    text;
    v_anon_exec boolean;
    v_auth_exec boolean;
BEGIN
    SELECT count(*) INTO v_cnt
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'accept_banquet_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 accept_banquet_booking overload, found %.', v_cnt;
    END IF;
    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'accept_banquet_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: accept_banquet_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: accept_banquet_booking has no hardened search_path (got %).', v_search;
    END IF;

    v_anon_exec := has_function_privilege('anon', 'public.accept_banquet_booking(uuid)', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.accept_banquet_booking(uuid)', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE accept_banquet_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE accept_banquet_booking.';
    END IF;

    RAISE NOTICE 'OK: accept_banquet_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
