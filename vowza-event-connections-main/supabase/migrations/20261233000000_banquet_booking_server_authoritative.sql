-- 20261233000000_banquet_booking_server_authoritative.sql
--
-- P0-1 (banquet category): move booking financial authority off the browser.
--
-- BEFORE: src/components/BanquetHallMenu.tsx (the "Book Now" modal) inserted
--   directly into public.banquet_bookings with base_amount / addons_amount /
--   total_amount / advance_amount / remaining_amount taken from CLIENT-computed
--   values, and the generic cart path in src/pages/Checkout.tsx did the same via
--   a dynamic-table INSERT using a flat ADVANCE_PERCENT = 20. Worse, the cart
--   added banquet with price = Number(pkg.package_price || pkg.price || 0) — but
--   banquet_halls has NEITHER column (its price is hall_rental_price), so the
--   cart path created ZERO-amount banquet bookings. A tampered client could also
--   post any amounts (e.g. total_amount = 1) via the menu and the row persisted
--   them.
--
-- AFTER: the browser calls public.create_banquet_booking(...) passing ONLY
--   identifiers / selections / descriptive fields. This SECURITY DEFINER RPC
--   fetches the authoritative hall price + addon prices server-side, derives
--   every financial value, forces customer_id = auth.uid(), and inserts
--   atomically. No financial value crosses the trust boundary from the browser.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes of the amount columns is parked separately
-- at supabase/migrations-pending/PHASE_banquet_bookings_column_lockdown.sql and
-- must NOT be promoted until this RPC + the rewired frontend are live.
--
-- Formula reproduced EXACTLY from BanquetHallMenu.tsx (P0-1 Step 7 — preserve
-- business logic; do not "fix" it here):
--   base    = coalesce(hall_rental_price, 0)  -- the SINGLE hall_rental_price
--             column (BanquetHallMenu's Number(pkg.hall_rental_price || 0)).
--             Banquet has NO quantity/multiplier: guest_count is a free-text
--             range label ("100-200"), never a pricing input — the total is
--             hall_rental_price + addons. The hall's security_deposit /
--             cleaning_charges / decoration_permission_fee / generator_charges /
--             extra_hour_charges / outside_catering_charges are NOT totalled by
--             the menu, so they are NOT totalled here.
--   addons  = sum(price) of the selected addons that belong to the hall.
--             hall_addons HAS an is_active column, but — matching the band pilot
--             / singer / videography / water convention — this RPC does NOT
--             filter on it: the id must belong to the hall, and the price is
--             taken from the trusted row. BanquetHallMenu loads hall_addons(*)
--             with NO is_active filter and lets the user select, so summing the
--             passed hall-owned ids reproduces the menu exactly.
--   total   = base + addons
--   advance = round(total * advance_percentage / 100)  -- BANQUET HONORS the
--             hall's per-hall advance_percentage (integer DEFAULT 20), like
--             dancer/makeup/mehendi/priest/rental/singer/videography/water — NOT
--             a hardcoded flat 20%. Mirrors BanquetHallMenu's
--             Number(pkg.advance_percentage || 20): NULL or 0 -> 20.
--   remaining = total - advance
--   Banquet STORES advance/remaining AT CREATION (mirrors BanquetHallMenu, which
--   writes all five amounts at insert time — like dancer/priest/rental/singer/
--   videography/water). event_type does NOT fall back to any hall field
--   (BanquetHallMenu writes event_type = eventType || null at INSERT; the
--   venue_type fallback it uses in the success screen is DISPLAY-only — like
--   singer/videography/rental, UNLIKE priest/water). event_type / event_time /
--   guest_count / venue / city / special_requirements are DESCRIPTIVE fields
--   only — never pricing inputs.
--
-- ROLLBACK: DROP FUNCTION public.create_banquet_booking(uuid,date,text,text,text,text,text,text,uuid[]);
--   The old BanquetHallMenu / Checkout direct-insert paths would then have to be
--   restored to keep banquet bookings working; nothing else depends on this.
BEGIN;
-- ===========================================================================
-- FAIL-CLOSED DRIFT GUARD. Introspect the LIVE schema and abort (rolling back
-- the whole migration) if the columns/types this RPC reads and writes are not
-- exactly what the repo snapshot assumes. Uses pg_attribute, not the repo.
-- ===========================================================================
DO $catalog$
DECLARE
    req         record;
    v_missing   text := '';
    v_price_typ text;
    v_pct_typ   text;
BEGIN
    FOR req IN
        SELECT tbl, col FROM (VALUES
            ('banquet_halls','id'), ('banquet_halls','provider_id'),
            ('banquet_halls','hall_rental_price'),
            ('banquet_halls','advance_percentage'), ('banquet_halls','status'),
            ('hall_addons','id'), ('hall_addons','package_id'),
            ('hall_addons','price'),
            ('banquet_bookings','id'), ('banquet_bookings','customer_id'),
            ('banquet_bookings','provider_id'), ('banquet_bookings','package_id'),
            ('banquet_bookings','event_date'), ('banquet_bookings','event_time'),
            ('banquet_bookings','event_type'), ('banquet_bookings','guest_count'),
            ('banquet_bookings','venue'), ('banquet_bookings','city'),
            ('banquet_bookings','special_requirements'),
            ('banquet_bookings','selected_addon_ids'),
            ('banquet_bookings','base_amount'), ('banquet_bookings','addons_amount'),
            ('banquet_bookings','total_amount'), ('banquet_bookings','advance_amount'),
            ('banquet_bookings','remaining_amount'), ('banquet_bookings','status'),
            ('banquet_bookings','created_at')
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
        RAISE EXCEPTION 'ABORT create_banquet_booking: live schema is missing expected column(s):%', v_missing;
    END IF;
    -- The hall price must be a numeric type; if it drifted to text the
    -- server-side arithmetic below would behave unexpectedly.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_price_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.banquet_halls'::regclass
       AND a.attname = 'hall_rental_price' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_price_typ IS NULL OR v_price_typ NOT LIKE 'numeric%' THEN
        RAISE EXCEPTION 'ABORT create_banquet_booking: banquet_halls.hall_rental_price is % (expected numeric).', v_price_typ;
    END IF;
    -- The advance rate must be an integer type (advance_percentage); a drift to
    -- text/float would change how the advance rounds.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_pct_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.banquet_halls'::regclass
       AND a.attname = 'advance_percentage' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_pct_typ IS NULL OR v_pct_typ NOT LIKE 'integer%' THEN
        RAISE EXCEPTION 'ABORT create_banquet_booking: banquet_halls.advance_percentage is % (expected integer).', v_pct_typ;
    END IF;

    RAISE NOTICE 'OK: banquet create schema matches; creating create_banquet_booking.';
END $catalog$;
-- ===========================================================================
-- Server-authoritative banquet booking CREATE. The browser passes ONLY
-- identifiers / selections / descriptive fields. Every financial value and the
-- customer identity are decided here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.create_banquet_booking(
    p_package_id           uuid,
    p_event_date           date,
    p_event_time           text   DEFAULT NULL,
    p_event_type           text   DEFAULT NULL,
    p_guest_count          text   DEFAULT NULL,
    p_venue                text   DEFAULT NULL,
    p_city                 text   DEFAULT NULL,
    p_special_requirements text   DEFAULT NULL,
    p_addon_ids            uuid[] DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid        uuid := auth.uid();
    v_pkg        public.banquet_halls%rowtype;
    v_base       numeric;
    v_addons     numeric;
    v_total      numeric;
    v_pct        integer;
    v_advance    numeric;
    v_remaining  numeric;
    v_addon_ids  uuid[] := coalesce(p_addon_ids, '{}'::uuid[]);
    v_valid_ids  uuid[];
    v_booking_id uuid;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
    END IF;
    IF p_package_id IS NULL THEN
        RAISE EXCEPTION 'A venue is required' USING ERRCODE = '22023';
    END IF;
    IF p_event_date IS NULL THEN
        RAISE EXCEPTION 'An event date is required' USING ERRCODE = '22023';
    END IF;
    -- Row-lock the hall so its price cannot change under us mid-insert.
    SELECT * INTO v_pkg
      FROM public.banquet_halls
     WHERE id = p_package_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venue not available' USING ERRCODE = 'P0002';
    END IF;
    -- Only an active hall may be booked (mirrors BanquetHallMenu, which lists
    -- only status = 'active' halls).
    IF v_pkg.status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'This venue is not available for booking (status: %)', v_pkg.status
            USING ERRCODE = '22023';
    END IF;
    -- Base = the single hall_rental_price column. Banquet has NO
    -- quantity/multiplier (guest_count is a free-text range label) and NO
    -- ancillary charge columns the menu totals — base is just hall_rental_price.
    v_base := coalesce(nullif(v_pkg.hall_rental_price, 0), 0);

    -- Addons = sum(price) of the passed addon ids that ACTUALLY belong to this
    -- hall. Ids that do not belong are ignored (cannot borrow another hall's
    -- addon, cannot inflate/deflate the total). NO is_active filter — hall_addons
    -- HAS an is_active column, but BanquetHallMenu loads hall_addons(*) unfiltered
    -- and the passed ids are exactly what the user picked, so summing the passed
    -- hall-owned ids reproduces the menu. We persist only the validated ids, so
    -- selected_addon_ids can never claim an addon whose price the total omitted.
    SELECT coalesce(sum(a.price), 0),
           coalesce(array_agg(a.id ORDER BY a.id), '{}'::uuid[])
      INTO v_addons, v_valid_ids
      FROM public.hall_addons a
     WHERE a.package_id = v_pkg.id
       AND a.id = ANY (v_addon_ids);
    v_total := v_base + v_addons;

    -- Advance rate = the hall's authoritative advance_percentage. Mirrors
    -- BanquetHallMenu's Number(pkg.advance_percentage || 20): NULL or 0 -> 20.
    v_pct       := coalesce(nullif(v_pkg.advance_percentage, 0), 20);
    v_advance   := round(v_total * v_pct / 100.0);
    v_remaining := v_total - v_advance;
    -- customer_id is FORCED to the caller; provider_id is taken from the trusted
    -- hall, never from client-supplied values. Advance / remaining are stored at
    -- creation (mirrors BanquetHallMenu). event_type does NOT fall back to any
    -- hall column (BanquetHallMenu writes eventType || null at INSERT).
    -- event_type / event_time / guest_count / venue / city /
    -- special_requirements are descriptive only.
    INSERT INTO public.banquet_bookings (
        package_id, provider_id, customer_id,
        event_date, event_time, event_type,
        guest_count, venue, city, special_requirements,
        selected_addon_ids,
        base_amount, addons_amount, total_amount,
        advance_amount, remaining_amount,
        status
    ) VALUES (
        v_pkg.id, v_pkg.provider_id, v_uid,
        p_event_date, nullif(p_event_time, ''), nullif(p_event_type, ''),
        nullif(p_guest_count, ''), nullif(p_venue, ''), nullif(p_city, ''),
        nullif(p_special_requirements, ''),
        v_valid_ids,
        v_base, v_addons, v_total,
        v_advance, v_remaining,
        'pending'
    )
    RETURNING id INTO v_booking_id;

    RETURN v_booking_id;
END $fn$;
-- Callable only by signed-in users; never anon/public. The RPC itself forces
-- customer_id = auth.uid() and derives every amount.
REVOKE ALL ON FUNCTION public.create_banquet_booking(uuid,date,text,text,text,text,text,text,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_banquet_booking(uuid,date,text,text,text,text,text,text,uuid[]) TO authenticated;
-- ===========================================================================
-- FAIL-CLOSED SELF-CHECK. Prove the function landed exactly as intended.
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
     WHERE n.nspname = 'public' AND p.proname = 'create_banquet_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 create_banquet_booking overload, found %.', v_cnt;
    END IF;
    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_banquet_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: create_banquet_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: create_banquet_booking has no hardened search_path (got %).', v_search;
    END IF;

    v_anon_exec := has_function_privilege('anon', 'public.create_banquet_booking(uuid,date,text,text,text,text,text,text,uuid[])', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.create_banquet_booking(uuid,date,text,text,text,text,text,text,uuid[])', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE create_banquet_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE create_banquet_booking.';
    END IF;

    RAISE NOTICE 'OK: create_banquet_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
