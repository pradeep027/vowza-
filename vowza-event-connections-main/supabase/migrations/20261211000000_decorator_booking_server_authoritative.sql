-- 20261211000000_decorator_booking_server_authoritative.sql
--
-- P0-1 (decorator category): move booking financial authority off the browser.
--
-- BEFORE: src/components/DecoratorMenu.tsx (the "Book Now" modal) inserted
--   directly into public.decorator_bookings with base_amount / addons_amount /
--   total_amount taken from CLIENT-computed values, and the generic cart path in
--   src/pages/Checkout.tsx did the same (that generic INSERT was in fact broken
--   for decorator — it writes special_requirements / advance_amount, columns the
--   decorator flow does not use). A tampered client could post any amounts
--   (e.g. total_amount = 1) and the row would persist them.
--
-- AFTER: the browser calls public.create_decorator_booking(...) passing ONLY
--   identifiers / selections / descriptive fields. This SECURITY DEFINER RPC
--   fetches the authoritative package price + addon prices server-side, derives
--   every financial value, forces customer_id = auth.uid(), and inserts
--   atomically. No financial value crosses the trust boundary from the browser.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes of the amount columns is parked separately
-- at supabase/migrations-pending/PHASE_decorator_bookings_column_lockdown.sql and
-- must NOT be promoted until this RPC + the rewired frontend are live.
--
-- Formula reproduced EXACTLY from DecoratorMenu.tsx (P0-1 Step 4 — preserve
-- business logic; do not "fix" it here):
--   base    = coalesce(package_price, 0)   -- flat package price, NOT per-plate.
--             decorator_packages also has travel_charges / setup_charges, but the
--             DecoratorMenu total is package_price + addons only — those extra
--             package columns are NOT summed into the booking total, so this RPC
--             does not add them either.
--   addons  = sum(price) of the selected addons that belong to the package
--   total   = base + addons
--   Advance/remaining are NOT written at creation (mirrors DecoratorMenu, which
--   stores only base/addons/total at insert time). They are derived at ACCEPT by
--   accept_decorator_booking from the STORED total. theme_preference /
--   special_instructions are stored as descriptive fields ONLY — never pricing
--   inputs (the total is package_price + addons regardless of them).
--
-- ROLLBACK: DROP FUNCTION public.create_decorator_booking(uuid,date,text,text,text,text,text,uuid[],text);
--   The old DecoratorMenu / Checkout direct-insert paths would then have to be
--   restored to keep decorator bookings working; nothing else depends on this.

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
    -- Every column this RPC reads (packages/addons) or writes (bookings) must
    -- exist in the LIVE catalog, or we abort rather than insert into a schema
    -- that has drifted from this snapshot.
    FOR req IN
        SELECT tbl, col FROM (VALUES
            ('decorator_packages','id'), ('decorator_packages','provider_id'),
            ('decorator_packages','package_price'), ('decorator_packages','status'),
            ('decorator_addons','id'), ('decorator_addons','package_id'),
            ('decorator_addons','price'),
            ('decorator_bookings','id'), ('decorator_bookings','customer_id'),
            ('decorator_bookings','provider_id'), ('decorator_bookings','package_id'),
            ('decorator_bookings','event_date'), ('decorator_bookings','event_time'),
            ('decorator_bookings','event_type'), ('decorator_bookings','venue'),
            ('decorator_bookings','city'), ('decorator_bookings','theme_preference'),
            ('decorator_bookings','special_instructions'),
            ('decorator_bookings','selected_addon_ids'),
            ('decorator_bookings','base_amount'), ('decorator_bookings','addons_amount'),
            ('decorator_bookings','total_amount'), ('decorator_bookings','status'),
            ('decorator_bookings','created_at')
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
        RAISE EXCEPTION 'ABORT create_decorator_booking: live schema is missing expected column(s):%', v_missing;
    END IF;

    -- The package price must be a numeric type; if it drifted to text the
    -- server-side arithmetic below would behave unexpectedly.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_price_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.decorator_packages'::regclass
       AND a.attname = 'package_price' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_price_typ IS NULL OR v_price_typ NOT LIKE 'numeric%' THEN
        RAISE EXCEPTION 'ABORT create_decorator_booking: decorator_packages.package_price is % (expected numeric).', v_price_typ;
    END IF;

    RAISE NOTICE 'OK: decorator create schema matches; creating create_decorator_booking.';
END $catalog$;
-- ===========================================================================
-- Server-authoritative decorator booking CREATE. The browser passes ONLY
-- identifiers / selections / descriptive fields. Every financial value and the
-- customer identity are decided here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.create_decorator_booking(
    p_package_id           uuid,
    p_event_date           date,
    p_event_time           text   DEFAULT NULL,
    p_event_type           text   DEFAULT NULL,
    p_venue                text   DEFAULT NULL,
    p_city                 text   DEFAULT NULL,
    p_theme_preference     text   DEFAULT NULL,
    p_addon_ids            uuid[] DEFAULT '{}'::uuid[],
    p_special_instructions text   DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid        uuid := auth.uid();
    v_pkg        public.decorator_packages%rowtype;
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
      FROM public.decorator_packages
     WHERE id = p_package_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Package not available' USING ERRCODE = 'P0002';
    END IF;
    -- Only an active package may be booked (mirrors DecoratorMenu, which lists
    -- only status = 'active' packages).
    IF v_pkg.status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'This package is not available for booking (status: %)', v_pkg.status
            USING ERRCODE = '22023';
    END IF;

    -- Base = flat package price. NOT per-plate; travel_charges / setup_charges are
    -- deliberately NOT summed (the DecoratorMenu total excludes them).
    v_base := coalesce(v_pkg.package_price, 0);

    -- Addons = sum(price) of the passed addon ids that ACTUALLY belong to this
    -- package. Ids that do not belong are ignored (cannot borrow another
    -- package's addon, cannot inflate/deflate the total). We persist only the
    -- validated ids, so selected_addon_ids can never claim an addon whose price
    -- the total did not include.
    SELECT coalesce(sum(a.price), 0),
           coalesce(array_agg(a.id ORDER BY a.id), '{}'::uuid[])
      INTO v_addons, v_valid_ids
      FROM public.decorator_addons a
     WHERE a.package_id = v_pkg.id
       AND a.id = ANY (v_addon_ids);

    v_total := v_base + v_addons;

    -- customer_id is FORCED to the caller; provider_id is taken from the package,
    -- never from a client-supplied value. Advance / remaining are NOT written at
    -- creation (mirrors DecoratorMenu) — they are derived at accept from the
    -- stored, authoritative total by accept_decorator_booking.
    INSERT INTO public.decorator_bookings (
        package_id, provider_id, customer_id,
        event_date, event_time, event_type,
        venue, city, theme_preference, special_instructions,
        selected_addon_ids,
        base_amount, addons_amount, total_amount,
        status
    ) VALUES (
        v_pkg.id, v_pkg.provider_id, v_uid,
        p_event_date, p_event_time, p_event_type,
        p_venue, p_city, p_theme_preference, p_special_instructions,
        v_valid_ids,
        v_base, v_addons, v_total,
        'pending'
    )
    RETURNING id INTO v_booking_id;

    RETURN v_booking_id;
END $fn$;

-- Callable only by signed-in users; never anon/public. The RPC itself forces
-- customer_id = auth.uid() and derives every amount.
REVOKE ALL ON FUNCTION public.create_decorator_booking(uuid,date,text,text,text,text,text,uuid[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_decorator_booking(uuid,date,text,text,text,text,text,uuid[],text) TO authenticated;
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
     WHERE n.nspname = 'public' AND p.proname = 'create_decorator_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 create_decorator_booking overload, found %.', v_cnt;
    END IF;

    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_decorator_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: create_decorator_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: create_decorator_booking has no hardened search_path (got %).', v_search;
    END IF;

    v_anon_exec := has_function_privilege('anon', 'public.create_decorator_booking(uuid,date,text,text,text,text,text,uuid[],text)', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.create_decorator_booking(uuid,date,text,text,text,text,text,uuid[],text)', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE create_decorator_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE create_decorator_booking.';
    END IF;

    RAISE NOTICE 'OK: create_decorator_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
