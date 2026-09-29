-- 20261217000000_drone_booking_server_authoritative.sql
--
-- P0-1 (Drone category): move booking financial authority off the browser.
--
-- BEFORE: src/components/DroneMenu.tsx (the "Book Now" modal) inserted directly
--   into public.drone_bookings with base_amount / addons_amount / total_amount
--   taken from CLIENT-computed values, and the generic cart path in
--   src/pages/Checkout.tsx did the same via a dynamic-table INSERT using a flat
--   ADVANCE_PERCENT = 20. A tampered client could post any amounts (e.g.
--   total_amount = 1) and the row would persist them.
--
-- AFTER: the browser calls public.create_drone_booking(...) passing ONLY
--   identifiers / selections / descriptive fields. This SECURITY DEFINER RPC
--   fetches the authoritative package price + addon prices server-side, derives
--   every financial value, forces customer_id = auth.uid(), and inserts
--   atomically. No financial value crosses the trust boundary from the browser.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes of the amount columns is parked separately
-- at supabase/migrations-pending/PHASE_drone_bookings_column_lockdown.sql and
-- must NOT be promoted until this RPC + the rewired frontend are live.
--
-- Formula reproduced EXACTLY from DroneMenu.tsx (P0-1 Step 3 — preserve business
-- logic; do not "fix" it here):
--   base    = package_price OR starting_price OR fixed_price OR hourly_price OR 0
--             — DroneMenu picks the FIRST of these four package columns that is
--             truthy (JS ||: 0 / NULL fall through). This RPC mirrors that with
--             coalesce(nullif(col,0), ...): a 0 or NULL price column falls through
--             to the next candidate, exactly like the menu. drone_packages ALSO
--             has full_day_price / half_day_price / extra_flight_hour_charges /
--             travel_charges_amount, but the DroneMenu total is (chosen base) +
--             addons only — those are NOT summed, so this RPC does not add them.
--   addons  = sum(price) of the selected addons that belong to the package.
--             (DroneMenu sums the selected addons among ALL fetched drone_addons;
--             it does NOT filter on is_active, so neither does this RPC.)
--   total   = base + addons
--   Advance = FLAT 20% (DroneMenu hardcodes Math.round(total * 0.2)); Drone is NOT
--             a per-package advance_percentage category even though the column
--             exists (contrast dancer). Advance / remaining are NOT written at
--             creation — deferred to accept_drone_booking (mirrors DroneMenu).
--   coverage_duration / indoor_outdoor / drone_permission_available /
--   restricted_area / special_requests are descriptive/logistics ONLY — never
--   pricing inputs (the total is base + addons regardless of them).
--
-- ROLLBACK: DROP FUNCTION public.create_drone_booking(uuid,date,text,text,text,text,text,text,boolean,boolean,text,uuid[]);
--   The old DroneMenu / Checkout direct-insert paths would then have to be
--   restored to keep drone bookings working; nothing else depends on this.

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
BEGIN
    FOR req IN
        SELECT tbl, col FROM (VALUES
            ('drone_packages','id'), ('drone_packages','provider_id'),
            ('drone_packages','package_price'), ('drone_packages','starting_price'),
            ('drone_packages','fixed_price'), ('drone_packages','hourly_price'),
            ('drone_packages','status'),
            ('drone_addons','id'), ('drone_addons','package_id'),
            ('drone_addons','price'),
            ('drone_bookings','id'), ('drone_bookings','customer_id'),
            ('drone_bookings','provider_id'), ('drone_bookings','package_id'),
            ('drone_bookings','event_date'), ('drone_bookings','event_time'),
            ('drone_bookings','event_type'), ('drone_bookings','coverage_duration'),
            ('drone_bookings','venue'), ('drone_bookings','city'),
            ('drone_bookings','indoor_outdoor'),
            ('drone_bookings','drone_permission_available'),
            ('drone_bookings','restricted_area'),
            ('drone_bookings','special_requests'),
            ('drone_bookings','selected_addon_ids'),
            ('drone_bookings','base_amount'), ('drone_bookings','addons_amount'),
            ('drone_bookings','total_amount'), ('drone_bookings','status'),
            ('drone_bookings','created_at')
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
        RAISE EXCEPTION 'ABORT create_drone_booking: live schema is missing expected column(s):%', v_missing;
    END IF;
    -- The package price must be a numeric type; if it drifted to text the
    -- server-side arithmetic below would behave unexpectedly.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_price_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.drone_packages'::regclass
       AND a.attname = 'package_price' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_price_typ IS NULL OR v_price_typ NOT LIKE 'numeric%' THEN
        RAISE EXCEPTION 'ABORT create_drone_booking: drone_packages.package_price is % (expected numeric).', v_price_typ;
    END IF;

    RAISE NOTICE 'OK: drone create schema matches; creating create_drone_booking.';
END $catalog$;
-- ===========================================================================
-- Server-authoritative Drone booking CREATE. The browser passes ONLY identifiers
-- / selections / descriptive fields. Every financial value and the customer
-- identity are decided here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.create_drone_booking(
    p_package_id                 uuid,
    p_event_date                 date,
    p_event_time                 text    DEFAULT NULL,
    p_event_type                 text    DEFAULT NULL,
    p_venue                      text    DEFAULT NULL,
    p_city                       text    DEFAULT NULL,
    p_coverage_duration          text    DEFAULT NULL,
    p_indoor_outdoor             text    DEFAULT NULL,
    p_drone_permission_available boolean DEFAULT NULL,
    p_restricted_area            boolean DEFAULT NULL,
    p_special_requests           text    DEFAULT NULL,
    p_addon_ids                  uuid[]  DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid        uuid := auth.uid();
    v_pkg        public.drone_packages%rowtype;
    v_base       numeric;
    v_addons     numeric;
    v_total      numeric;
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
      FROM public.drone_packages
     WHERE id = p_package_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Package not available' USING ERRCODE = 'P0002';
    END IF;
    -- Only an active package may be booked (mirrors DroneMenu, which lists only
    -- status = 'active' packages).
    IF v_pkg.status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'This package is not available for booking (status: %)', v_pkg.status
            USING ERRCODE = '22023';
    END IF;

    -- Base = the FIRST truthy price among package_price / starting_price /
    -- fixed_price / hourly_price, exactly like DroneMenu's JS || chain. nullif(x,0)
    -- turns a 0 into NULL so coalesce skips it, matching the menu (which treats 0
    -- as falsy and falls through). full_day_price / half_day_price /
    -- extra_flight_hour_charges / travel_charges_amount are NOT summed (the menu
    -- total excludes them).
    v_base := coalesce(
        nullif(v_pkg.package_price, 0),
        nullif(v_pkg.starting_price, 0),
        nullif(v_pkg.fixed_price, 0),
        nullif(v_pkg.hourly_price, 0),
        0
    );

    -- Addons = sum(price) of the passed addon ids that ACTUALLY belong to this
    -- package. Ids that do not belong are ignored (cannot borrow another
    -- package's addon, cannot inflate/deflate the total). We persist only the
    -- validated ids, so selected_addon_ids can never claim an addon whose price
    -- the total did not include. No is_active filter (mirrors DroneMenu, which
    -- sums the selected addons among ALL fetched drone_addons).
    SELECT coalesce(sum(a.price), 0),
           coalesce(array_agg(a.id ORDER BY a.id), '{}'::uuid[])
      INTO v_addons, v_valid_ids
      FROM public.drone_addons a
     WHERE a.package_id = v_pkg.id
       AND a.id = ANY (v_addon_ids);

    v_total := v_base + v_addons;

    -- customer_id is FORCED to the caller; provider_id is taken from the trusted
    -- package, never from a client-supplied value. Advance / remaining are NOT
    -- written at creation (mirrors DroneMenu) — they are derived at accept from
    -- the stored, authoritative total by accept_drone_booking at a FLAT 20%.
    -- coverage_duration / indoor_outdoor / drone_permission_available /
    -- restricted_area / special_requests are descriptive/logistics.
    INSERT INTO public.drone_bookings (
        package_id, provider_id, customer_id,
        event_date, event_time, event_type,
        coverage_duration, venue, city,
        indoor_outdoor, drone_permission_available, restricted_area,
        special_requests, selected_addon_ids,
        base_amount, addons_amount, total_amount,
        status
    ) VALUES (
        v_pkg.id, v_pkg.provider_id, v_uid,
        p_event_date, p_event_time, p_event_type,
        p_coverage_duration, p_venue, p_city,
        p_indoor_outdoor, p_drone_permission_available, p_restricted_area,
        p_special_requests, v_valid_ids,
        v_base, v_addons, v_total,
        'pending'
    )
    RETURNING id INTO v_booking_id;

    RETURN v_booking_id;
END $fn$;
-- Callable only by signed-in users; never anon/public. The RPC itself forces
-- customer_id = auth.uid() and derives every amount.
REVOKE ALL ON FUNCTION public.create_drone_booking(uuid,date,text,text,text,text,text,text,boolean,boolean,text,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_drone_booking(uuid,date,text,text,text,text,text,text,boolean,boolean,text,uuid[]) TO authenticated;
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
     WHERE n.nspname = 'public' AND p.proname = 'create_drone_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 create_drone_booking overload, found %.', v_cnt;
    END IF;

    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_drone_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: create_drone_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: create_drone_booking has no hardened search_path (got %).', v_search;
    END IF;

    v_anon_exec := has_function_privilege('anon', 'public.create_drone_booking(uuid,date,text,text,text,text,text,text,boolean,boolean,text,uuid[])', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.create_drone_booking(uuid,date,text,text,text,text,text,text,boolean,boolean,text,uuid[])', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE create_drone_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE create_drone_booking.';
    END IF;

    RAISE NOTICE 'OK: create_drone_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';

