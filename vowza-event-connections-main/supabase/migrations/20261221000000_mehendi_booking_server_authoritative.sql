-- 20261221000000_mehendi_booking_server_authoritative.sql
--
-- P0-1 (mehendi category): move booking financial authority off the browser.
--
-- BEFORE: src/components/MehendiMenu.tsx (the "Book Now" modal) inserted directly
--   into public.mehendi_bookings with base_amount / addons_amount / total_amount
--   taken from CLIENT-computed values (advance/remaining were NOT stored at
--   creation — deferred to accept). The generic cart path in Checkout.tsx ALSO
--   inserted directly, with a flat ADVANCE_PERCENT = 20 and client amounts. A
--   tampered client could post any amounts (e.g. total_amount = 1).
--
-- AFTER: the browser calls public.create_mehendi_booking(...) passing ONLY
--   identifiers / selections / descriptive fields. This SECURITY DEFINER RPC
--   fetches the authoritative package price + addon prices server-side, derives
--   base/addons/total, forces customer_id = auth.uid(), takes provider_id from
--   the trusted package, and inserts atomically. No financial value crosses the
--   trust boundary from the browser.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes of the amount columns is parked separately
-- at supabase/migrations-pending/PHASE_mehendi_bookings_column_lockdown.sql and
-- must NOT be promoted until this RPC + the rewired frontend are live.
--
-- Formula reproduced EXACTLY from MehendiMenu.tsx (P0-1 Step 7 — preserve business
-- logic; do not "fix" it here):
--   base    = coalesce(package_price, 0)   -- FLAT package price (pkg.package_price||0).
--             NOTE: mehendi_packages ALSO has price_per_hand / price_per_person /
--             festival_charges / travel_charges / outside_city_charges / group_discount
--             columns, but MehendiMenu's pricing uses ONLY package_price + addons
--             (baseAmount = Number(pkg.package_price||0); total = base + addons). Those
--             other columns are NOT pricing inputs in the current flow, so this RPC
--             faithfully uses package_price ONLY (preserve behavior; do not "fix").
--   addons  = sum(price) of the selected addons that belong to the package.
--             MehendiMenu fetches mehendi_addons(*) with NO is_active filter and
--             sums the selected ones, so this RPC does the same (no is_active
--             filter) — preserve behavior; the price is authoritative regardless.
--   total   = base + addons
--   Mehendi DEFERS advance/remaining: the modal computes them for DISPLAY only and
--   does NOT persist them at INSERT (this INSERT omits them, matching the modal).
--   The authoritative advance is derived at accept from the package's
--   advance_percentage (see 20261222000000_mehendi_booking_accept_authoritative.sql).
--   num_clients is DESCRIPTIVE ONLY: the modal collects it and shows an "extra
--   clients may cost more" NOTICE, but the total is package_price + addons
--   regardless — MehendiMenu NEVER multiplies by num_clients. It is stored for the
--   provider's information; it is NOT a pricing multiplier. event_type / venue /
--   city / special_requirements are DESCRIPTIVE ONLY too.
--
-- ROLLBACK: DROP FUNCTION public.create_mehendi_booking(uuid,date,text,text,text,text,integer,text,uuid[]);
--   The old MehendiMenu / Checkout direct-insert paths would then have to be
--   restored to keep mehendi bookings working; nothing else depends on this.

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
            ('mehendi_packages','id'), ('mehendi_packages','provider_id'),
            ('mehendi_packages','package_price'), ('mehendi_packages','status'),
            ('mehendi_addons','id'), ('mehendi_addons','package_id'),
            ('mehendi_addons','price'),
            ('mehendi_bookings','id'), ('mehendi_bookings','customer_id'),
            ('mehendi_bookings','provider_id'), ('mehendi_bookings','package_id'),
            ('mehendi_bookings','event_date'), ('mehendi_bookings','event_time'),
            ('mehendi_bookings','event_type'), ('mehendi_bookings','venue'),
            ('mehendi_bookings','city'), ('mehendi_bookings','special_requirements'),
            ('mehendi_bookings','num_clients'), ('mehendi_bookings','selected_addon_ids'),
            ('mehendi_bookings','base_amount'), ('mehendi_bookings','addons_amount'),
            ('mehendi_bookings','total_amount'), ('mehendi_bookings','status'),
            ('mehendi_bookings','created_at')
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
        RAISE EXCEPTION 'ABORT create_mehendi_booking: live schema is missing expected column(s):%', v_missing;
    END IF;

    -- The package price must be a numeric type; if it drifted to text the
    -- server-side arithmetic below would behave unexpectedly.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_price_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.mehendi_packages'::regclass
       AND a.attname = 'package_price' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_price_typ IS NULL OR v_price_typ NOT LIKE 'numeric%' THEN
        RAISE EXCEPTION 'ABORT create_mehendi_booking: mehendi_packages.package_price is % (expected numeric).', v_price_typ;
    END IF;

    RAISE NOTICE 'OK: mehendi create schema matches; creating create_mehendi_booking.';
END $catalog$;
-- ===========================================================================
-- Server-authoritative mehendi booking CREATE. The browser passes ONLY
-- identifiers / selections / descriptive fields. Every financial value and the
-- customer identity are decided here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.create_mehendi_booking(
    p_package_id           uuid,
    p_event_date           date,
    p_event_time           text    DEFAULT NULL,
    p_event_type           text    DEFAULT NULL,
    p_venue                text    DEFAULT NULL,
    p_city                 text    DEFAULT NULL,
    p_num_clients          integer DEFAULT NULL,
    p_special_requirements text    DEFAULT NULL,
    p_addon_ids            uuid[]  DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid        uuid := auth.uid();
    v_pkg        public.mehendi_packages%rowtype;
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
      FROM public.mehendi_packages
     WHERE id = p_package_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Package not available' USING ERRCODE = 'P0002';
    END IF;
    -- Only an active package may be booked (mirrors MehendiMenu, which lists only
    -- status = 'active' packages).
    IF v_pkg.status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'This package is not available for booking (status: %)', v_pkg.status
            USING ERRCODE = '22023';
    END IF;
    -- Base = flat package price (mirrors MehendiMenu Number(pkg.package_price||0)).
    -- mehendi_packages has price_per_hand / price_per_person / *_charges columns too,
    -- but the menu's total is package_price + addons ONLY — this RPC uses the same.
    v_base := coalesce(v_pkg.package_price, 0);

    -- Addons = sum(price) of the passed ids that ACTUALLY belong to this package.
    -- NO is_active filter (MehendiMenu fetches mehendi_addons(*) unfiltered and sums
    -- the selected ones — preserve behavior). Ids not belonging to the package are
    -- ignored; only the validated ids are persisted, so selected_addon_ids can
    -- never claim an addon whose price the total did not include.
    SELECT coalesce(sum(a.price), 0),
           coalesce(array_agg(a.id ORDER BY a.id), '{}'::uuid[])
      INTO v_addons, v_valid_ids
      FROM public.mehendi_addons a
     WHERE a.package_id = v_pkg.id
       AND a.id = ANY (v_addon_ids);

    v_total := v_base + v_addons;

    -- customer_id is FORCED to the caller; provider_id is taken from the trusted
    -- package, never from client-supplied values. Advance/remaining are DEFERRED
    -- (not written here) — derived at accept from the package's advance_percentage
    -- (mirrors MehendiMenu, which omits them at INSERT). num_clients is stored as a
    -- DESCRIPTIVE field only — it is NOT a pricing multiplier (see header).
    INSERT INTO public.mehendi_bookings (
        package_id, provider_id, customer_id,
        event_date, event_time, event_type,
        venue, city, special_requirements,
        num_clients,
        selected_addon_ids,
        base_amount, addons_amount, total_amount,
        status
    ) VALUES (
        v_pkg.id, v_pkg.provider_id, v_uid,
        p_event_date, p_event_time, p_event_type,
        p_venue, p_city, p_special_requirements,
        p_num_clients,
        v_valid_ids,
        v_base, v_addons, v_total,
        'pending'
    )
    RETURNING id INTO v_booking_id;

    RETURN v_booking_id;
END $fn$;

-- Callable only by signed-in users; never anon/public. The RPC itself forces
-- customer_id = auth.uid() and derives every amount.
REVOKE ALL ON FUNCTION public.create_mehendi_booking(uuid,date,text,text,text,text,integer,text,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_mehendi_booking(uuid,date,text,text,text,text,integer,text,uuid[]) TO authenticated;
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
     WHERE n.nspname = 'public' AND p.proname = 'create_mehendi_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 create_mehendi_booking overload, found %.', v_cnt;
    END IF;

    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_mehendi_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: create_mehendi_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: create_mehendi_booking has no hardened search_path (got %).', v_search;
    END IF;

    v_anon_exec := has_function_privilege('anon', 'public.create_mehendi_booking(uuid,date,text,text,text,text,integer,text,uuid[])', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.create_mehendi_booking(uuid,date,text,text,text,text,integer,text,uuid[])', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE create_mehendi_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE create_mehendi_booking.';
    END IF;

    RAISE NOTICE 'OK: create_mehendi_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
