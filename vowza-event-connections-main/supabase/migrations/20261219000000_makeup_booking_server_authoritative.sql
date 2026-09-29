-- 20261219000000_makeup_booking_server_authoritative.sql
--
-- P0-1 (makeup category): move booking financial authority off the browser.
--
-- BEFORE: src/components/MakeupMenu.tsx (the "Book Now" modal) inserted directly
--   into public.makeup_bookings with base_amount / addons_amount / total_amount
--   taken from CLIENT-computed values (advance/remaining were NOT stored at
--   creation — deferred to accept). The generic cart path in Checkout.tsx ALSO
--   inserted directly, with a flat ADVANCE_PERCENT = 20 and client amounts. A
--   tampered client could post any amounts (e.g. total_amount = 1).
--
-- AFTER: the browser calls public.create_makeup_booking(...) passing ONLY
--   identifiers / selections / descriptive fields. This SECURITY DEFINER RPC
--   fetches the authoritative package price + addon prices server-side, derives
--   base/addons/total, forces customer_id = auth.uid(), takes provider_id from
--   the trusted package, and inserts atomically. No financial value crosses the
--   trust boundary from the browser.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes of the amount columns is parked separately
-- at supabase/migrations-pending/PHASE_makeup_bookings_column_lockdown.sql and
-- must NOT be promoted until this RPC + the rewired frontend are live.
--
-- Formula reproduced EXACTLY from MakeupMenu.tsx (P0-1 Step 7 — preserve business
-- logic; do not "fix" it here):
--   base    = coalesce(package_price, 0)   -- FLAT package price (pkg.package_price||0).
--   addons  = sum(price) of the selected addons that belong to the package.
--             MakeupMenu fetches makeup_addons(*) with NO is_active filter and
--             sums the selected ones, so this RPC does the same (no is_active
--             filter) — preserve behavior; the price is authoritative regardless.
--   total   = base + addons
--   Makeup DEFERS advance/remaining: the modal computes them for DISPLAY only and
--   does NOT persist them at INSERT (this INSERT omits them, matching the modal).
--   The authoritative advance is derived at accept from the package's
--   advance_percentage (see 20261220000000_makeup_booking_accept_authoritative.sql).
--   event_type / venue / city / special_requirements are DESCRIPTIVE ONLY — never
--   pricing inputs; the total is package_price + addons regardless. Makeup has NO
--   guest_count / quantity multiplier.
--
-- ROLLBACK: DROP FUNCTION public.create_makeup_booking(uuid,date,text,text,text,text,text,uuid[]);
--   The old MakeupMenu / Checkout direct-insert paths would then have to be
--   restored to keep makeup bookings working; nothing else depends on this.

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
            ('makeup_packages','id'), ('makeup_packages','provider_id'),
            ('makeup_packages','package_price'), ('makeup_packages','status'),
            ('makeup_addons','id'), ('makeup_addons','package_id'),
            ('makeup_addons','price'),
            ('makeup_bookings','id'), ('makeup_bookings','customer_id'),
            ('makeup_bookings','provider_id'), ('makeup_bookings','package_id'),
            ('makeup_bookings','event_date'), ('makeup_bookings','event_time'),
            ('makeup_bookings','event_type'), ('makeup_bookings','venue'),
            ('makeup_bookings','city'), ('makeup_bookings','special_requirements'),
            ('makeup_bookings','selected_addon_ids'),
            ('makeup_bookings','base_amount'), ('makeup_bookings','addons_amount'),
            ('makeup_bookings','total_amount'), ('makeup_bookings','status'),
            ('makeup_bookings','created_at')
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
        RAISE EXCEPTION 'ABORT create_makeup_booking: live schema is missing expected column(s):%', v_missing;
    END IF;

    -- The package price must be a numeric type; if it drifted to text the
    -- server-side arithmetic below would behave unexpectedly.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_price_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.makeup_packages'::regclass
       AND a.attname = 'package_price' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_price_typ IS NULL OR v_price_typ NOT LIKE 'numeric%' THEN
        RAISE EXCEPTION 'ABORT create_makeup_booking: makeup_packages.package_price is % (expected numeric).', v_price_typ;
    END IF;

    RAISE NOTICE 'OK: makeup create schema matches; creating create_makeup_booking.';
END $catalog$;
-- ===========================================================================
-- Server-authoritative makeup booking CREATE. The browser passes ONLY
-- identifiers / selections / descriptive fields. Every financial value and the
-- customer identity are decided here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.create_makeup_booking(
    p_package_id           uuid,
    p_event_date           date,
    p_event_time           text   DEFAULT NULL,
    p_event_type           text   DEFAULT NULL,
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
    v_pkg        public.makeup_packages%rowtype;
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
      FROM public.makeup_packages
     WHERE id = p_package_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Package not available' USING ERRCODE = 'P0002';
    END IF;
    -- Only an active package may be booked (mirrors MakeupMenu, which lists only
    -- status = 'active' packages).
    IF v_pkg.status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'This package is not available for booking (status: %)', v_pkg.status
            USING ERRCODE = '22023';
    END IF;
    -- Base = flat package price (mirrors MakeupMenu Number(pkg.package_price||0)).
    v_base := coalesce(v_pkg.package_price, 0);

    -- Addons = sum(price) of the passed ids that ACTUALLY belong to this package.
    -- NO is_active filter (MakeupMenu fetches makeup_addons(*) unfiltered and sums
    -- the selected ones — preserve behavior). Ids not belonging to the package are
    -- ignored; only the validated ids are persisted, so selected_addon_ids can
    -- never claim an addon whose price the total did not include.
    SELECT coalesce(sum(a.price), 0),
           coalesce(array_agg(a.id ORDER BY a.id), '{}'::uuid[])
      INTO v_addons, v_valid_ids
      FROM public.makeup_addons a
     WHERE a.package_id = v_pkg.id
       AND a.id = ANY (v_addon_ids);

    v_total := v_base + v_addons;

    -- customer_id is FORCED to the caller; provider_id is taken from the trusted
    -- package, never from client-supplied values. Advance/remaining are DEFERRED
    -- (not written here) — derived at accept from the package's advance_percentage
    -- (mirrors MakeupMenu, which omits them at INSERT).
    INSERT INTO public.makeup_bookings (
        package_id, provider_id, customer_id,
        event_date, event_time, event_type,
        venue, city, special_requirements,
        selected_addon_ids,
        base_amount, addons_amount, total_amount,
        status
    ) VALUES (
        v_pkg.id, v_pkg.provider_id, v_uid,
        p_event_date, p_event_time, p_event_type,
        p_venue, p_city, p_special_requirements,
        v_valid_ids,
        v_base, v_addons, v_total,
        'pending'
    )
    RETURNING id INTO v_booking_id;

    RETURN v_booking_id;
END $fn$;

-- Callable only by signed-in users; never anon/public. The RPC itself forces
-- customer_id = auth.uid() and derives every amount.
REVOKE ALL ON FUNCTION public.create_makeup_booking(uuid,date,text,text,text,text,text,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_makeup_booking(uuid,date,text,text,text,text,text,uuid[]) TO authenticated;
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
     WHERE n.nspname = 'public' AND p.proname = 'create_makeup_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 create_makeup_booking overload, found %.', v_cnt;
    END IF;

    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_makeup_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: create_makeup_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: create_makeup_booking has no hardened search_path (got %).', v_search;
    END IF;

    v_anon_exec := has_function_privilege('anon', 'public.create_makeup_booking(uuid,date,text,text,text,text,text,uuid[])', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.create_makeup_booking(uuid,date,text,text,text,text,text,uuid[])', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE create_makeup_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE create_makeup_booking.';
    END IF;

    RAISE NOTICE 'OK: create_makeup_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
