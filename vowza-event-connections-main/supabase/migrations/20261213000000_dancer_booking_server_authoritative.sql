-- 20261213000000_dancer_booking_server_authoritative.sql
--
-- P0-1 (dancer category): move booking financial authority off the browser.
--
-- BEFORE: src/components/DancerMenu.tsx (the "Book Now" modal) inserted directly
--   into public.dancer_bookings with base_amount / addons_amount / total_amount /
--   advance_amount / remaining_amount taken from CLIENT-computed values, and the
--   generic cart path in src/pages/Checkout.tsx did the same via a dynamic-table
--   INSERT using a flat ADVANCE_PERCENT = 20. A tampered client could post any
--   amounts (e.g. total_amount = 1) and the row would persist them.
--
-- AFTER: the browser calls public.create_dancer_booking(...) passing ONLY
--   identifiers / selections / descriptive fields. This SECURITY DEFINER RPC
--   fetches the authoritative package price + addon prices server-side, derives
--   every financial value, forces customer_id = auth.uid(), and inserts
--   atomically. No financial value crosses the trust boundary from the browser.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes of the amount columns is parked separately
-- at supabase/migrations-pending/PHASE_dancer_bookings_column_lockdown.sql and
-- must NOT be promoted until this RPC + the rewired frontend are live.
--
-- Formula reproduced EXACTLY from DancerMenu.tsx (P0-1 Step 7 — preserve business
-- logic; do not "fix" it here):
--   base    = coalesce(package_price, 0)   -- FLAT package price, NOT per-plate.
--   addons  = sum(price) of the selected addons that belong to the package
--             (the DancerMenu modal has no addon UI and always passes none, so
--             this is 0 in practice; summed here for forward-correctness).
--   total   = base + addons
--   advance = round(total * advance_percentage / 100)  -- KEY DANCER DIFFERENCE:
--             dancer_packages carries a PER-PACKAGE advance_percentage column
--             (integer NOT NULL DEFAULT 20, CHECK 0..100) that the DancerMenu
--             modal already uses. Unlike band/anchor/decorator (hardcoded flat
--             20%), the authoritative dancer advance rate is that column. The
--             modal computes advance from base; since addons are always 0 today,
--             base == total, so deriving from total is identical for every
--             currently reachable booking and forward-correct if addons appear.
--   remaining = total - advance
--   Dancer STORES advance/remaining AT CREATION (mirrors DancerMenu, which writes
--   them at insert time — unlike decorator/anchor, which defer to accept).
--   dance_type is taken from the trusted package (never user-editable in the
--   modal); number_of_dancers / performance_duration / special_requirements are
--   DESCRIPTIVE fields ONLY — never pricing inputs (the total is package_price +
--   addons regardless of them). number_of_dancers is NOT a per-plate multiplier
--   (contrast catering's guest_count).
--
-- ROLLBACK: DROP FUNCTION public.create_dancer_booking(uuid,date,text,text,text,text,integer,text,uuid[],text);
--   The old DancerMenu / Checkout direct-insert paths would then have to be
--   restored to keep dancer bookings working; nothing else depends on this.

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
    -- Every column this RPC reads (packages/addons) or writes (bookings) must
    -- exist in the LIVE catalog, or we abort rather than insert into a schema
    -- that has drifted from this snapshot.
    FOR req IN
        SELECT tbl, col FROM (VALUES
            ('dancer_packages','id'), ('dancer_packages','provider_id'),
            ('dancer_packages','package_price'), ('dancer_packages','advance_percentage'),
            ('dancer_packages','status'), ('dancer_packages','dance_type'),
            ('dancer_packages','team_size'), ('dancer_packages','duration'),
            ('dancer_addons','id'), ('dancer_addons','package_id'),
            ('dancer_addons','price'),
            ('dancer_bookings','id'), ('dancer_bookings','customer_id'),
            ('dancer_bookings','provider_id'), ('dancer_bookings','package_id'),
            ('dancer_bookings','event_date'), ('dancer_bookings','event_time'),
            ('dancer_bookings','event_type'), ('dancer_bookings','venue'),
            ('dancer_bookings','city'), ('dancer_bookings','dance_type'),
            ('dancer_bookings','number_of_dancers'), ('dancer_bookings','performance_duration'),
            ('dancer_bookings','special_requirements'), ('dancer_bookings','selected_addon_ids'),
            ('dancer_bookings','base_amount'), ('dancer_bookings','addons_amount'),
            ('dancer_bookings','total_amount'), ('dancer_bookings','advance_amount'),
            ('dancer_bookings','remaining_amount'), ('dancer_bookings','status'),
            ('dancer_bookings','created_at')
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
        RAISE EXCEPTION 'ABORT create_dancer_booking: live schema is missing expected column(s):%', v_missing;
    END IF;

    -- The package price must be a numeric type; if it drifted to text the
    -- server-side arithmetic below would behave unexpectedly.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_price_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.dancer_packages'::regclass
       AND a.attname = 'package_price' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_price_typ IS NULL OR v_price_typ NOT LIKE 'numeric%' THEN
        RAISE EXCEPTION 'ABORT create_dancer_booking: dancer_packages.package_price is % (expected numeric).', v_price_typ;
    END IF;

    -- The advance rate must be an integer type (advance_percentage); a drift to
    -- text/float would change how the advance rounds.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_pct_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.dancer_packages'::regclass
       AND a.attname = 'advance_percentage' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_pct_typ IS NULL OR v_pct_typ NOT LIKE 'integer%' THEN
        RAISE EXCEPTION 'ABORT create_dancer_booking: dancer_packages.advance_percentage is % (expected integer).', v_pct_typ;
    END IF;

    RAISE NOTICE 'OK: dancer create schema matches; creating create_dancer_booking.';
END $catalog$;
-- ===========================================================================
-- Server-authoritative dancer booking CREATE. The browser passes ONLY
-- identifiers / selections / descriptive fields. Every financial value and the
-- customer identity are decided here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.create_dancer_booking(
    p_package_id           uuid,
    p_event_date           date,
    p_event_time           text    DEFAULT NULL,
    p_event_type           text    DEFAULT NULL,
    p_venue                text    DEFAULT NULL,
    p_city                 text    DEFAULT NULL,
    p_number_of_dancers    integer DEFAULT NULL,
    p_performance_duration text    DEFAULT NULL,
    p_addon_ids            uuid[]  DEFAULT '{}'::uuid[],
    p_special_requirements text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid        uuid := auth.uid();
    v_pkg        public.dancer_packages%rowtype;
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
        RAISE EXCEPTION 'A package is required' USING ERRCODE = '22023';
    END IF;
    IF p_event_date IS NULL THEN
        RAISE EXCEPTION 'An event date is required' USING ERRCODE = '22023';
    END IF;

    -- Row-lock the package so its price cannot change under us mid-insert.
    SELECT * INTO v_pkg
      FROM public.dancer_packages
     WHERE id = p_package_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Package not available' USING ERRCODE = 'P0002';
    END IF;
    -- Only an active package may be booked (mirrors DancerMenu, which lists only
    -- status = 'active' packages).
    IF v_pkg.status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'This package is not available for booking (status: %)', v_pkg.status
            USING ERRCODE = '22023';
    END IF;

    -- Base = flat package price. NOT per-plate.
    v_base := coalesce(v_pkg.package_price, 0);

    -- Addons = sum(price) of the passed addon ids that ACTUALLY belong to this
    -- package. Ids that do not belong are ignored (cannot borrow another
    -- package's addon, cannot inflate/deflate the total). We persist only the
    -- validated ids, so selected_addon_ids can never claim an addon whose price
    -- the total did not include. (DancerMenu passes none today; forward-safe.)
    SELECT coalesce(sum(a.price), 0),
           coalesce(array_agg(a.id ORDER BY a.id), '{}'::uuid[])
      INTO v_addons, v_valid_ids
      FROM public.dancer_addons a
     WHERE a.package_id = v_pkg.id
       AND a.id = ANY (v_addon_ids);

    v_total := v_base + v_addons;

    -- Advance rate = the package's authoritative advance_percentage (NOT NULL
    -- DEFAULT 20; coalesce mirrors DancerMenu's Number(pkg.advance_percentage||20)).
    v_pct       := coalesce(v_pkg.advance_percentage, 20);
    v_advance   := round(v_total * v_pct / 100.0);
    v_remaining := v_total - v_advance;

    -- customer_id is FORCED to the caller; provider_id and dance_type are taken
    -- from the trusted package, never from client-supplied values. Advance /
    -- remaining are stored at creation (mirrors DancerMenu). number_of_dancers /
    -- performance_duration are descriptive; they fall back to the package's
    -- team_size / duration when the caller omits them (the modal's defaults).
    INSERT INTO public.dancer_bookings (
        package_id, provider_id, customer_id,
        event_date, event_time, event_type,
        venue, city, dance_type,
        number_of_dancers, performance_duration, special_requirements,
        selected_addon_ids,
        base_amount, addons_amount, total_amount,
        advance_amount, remaining_amount,
        status
    ) VALUES (
        v_pkg.id, v_pkg.provider_id, v_uid,
        p_event_date, p_event_time, p_event_type,
        p_venue, p_city, v_pkg.dance_type,
        coalesce(p_number_of_dancers, v_pkg.team_size, 1),
        coalesce(p_performance_duration, v_pkg.duration),
        p_special_requirements,
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
REVOKE ALL ON FUNCTION public.create_dancer_booking(uuid,date,text,text,text,text,integer,text,uuid[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_dancer_booking(uuid,date,text,text,text,text,integer,text,uuid[],text) TO authenticated;
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
     WHERE n.nspname = 'public' AND p.proname = 'create_dancer_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 create_dancer_booking overload, found %.', v_cnt;
    END IF;

    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_dancer_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: create_dancer_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: create_dancer_booking has no hardened search_path (got %).', v_search;
    END IF;

    v_anon_exec := has_function_privilege('anon', 'public.create_dancer_booking(uuid,date,text,text,text,text,integer,text,uuid[],text)', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.create_dancer_booking(uuid,date,text,text,text,text,integer,text,uuid[],text)', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE create_dancer_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE create_dancer_booking.';
    END IF;

    RAISE NOTICE 'OK: create_dancer_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
