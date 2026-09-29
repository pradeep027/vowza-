-- 20261223000000_priest_booking_server_authoritative.sql
--
-- P0-1 (priest category): move booking financial authority off the browser.
--
-- BEFORE: src/components/PriestMenu.tsx (the "Book Now" modal) inserted directly
--   into public.priest_bookings with base_amount / addons_amount / total_amount /
--   advance_amount / remaining_amount taken from CLIENT-computed values, and the
--   generic cart path in src/pages/Checkout.tsx did the same via a dynamic-table
--   INSERT using a flat ADVANCE_PERCENT = 20. A tampered client could post any
--   amounts (e.g. total_amount = 1) and the row would persist them. (That generic
--   INSERT also wrote special_requirements, a column priest_bookings LACKS — it
--   has special_instructions — so the cart path was already broken for priest.)
--
-- AFTER: the browser calls public.create_priest_booking(...) passing ONLY
--   identifiers / selections / descriptive fields. This SECURITY DEFINER RPC
--   fetches the authoritative package price + addon prices server-side, derives
--   every financial value, forces customer_id = auth.uid(), and inserts
--   atomically. No financial value crosses the trust boundary from the browser.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes of the amount columns is parked separately
-- at supabase/migrations-pending/PHASE_priest_bookings_column_lockdown.sql and
-- must NOT be promoted until this RPC + the rewired frontend are live.
--
-- Formula reproduced EXACTLY from PriestMenu.tsx (P0-1 Step 7 — preserve business
-- logic; do not "fix" it here):
--   base    = coalesce(service_price, 0)   -- the SINGLE service_price column
--             (PriestMenu's Number(pkg.service_price || 0)). NOT travel_charges /
--             outside_city_charges / extra_ritual_charges / extra_hours_charges,
--             which priest_packages also has but the menu NEVER adds to the total.
--   addons  = sum(price) of the selected addons that belong to the package.
--             priest_addons HAS is_active, but PriestMenu fetches priest_addons(*)
--             unfiltered and sums the selected ones, so this RPC sums the passed
--             ids with NO is_active filter (behavior preservation).
--   total   = base + addons
--   advance = round(total * advance_percentage / 100)  -- PRIEST HONORS the
--             package's per-package advance_percentage (integer DEFAULT 20), like
--             dancer/makeup/mehendi — NOT a hardcoded flat 20%. Mirrors PriestMenu's
--             Number(pkg.advance_percentage || 20): NULL or 0 -> 20.
--   remaining = total - advance
--   Priest STORES advance/remaining AT CREATION (mirrors PriestMenu, which writes
--   all five amounts at insert time — like dancer, unlike makeup/mehendi which
--   defer to accept). event_type falls back to the package_type when the caller
--   omits it (PriestMenu's eventType || pkg.package_type). event_type / venue /
--   city / special_instructions are DESCRIPTIVE fields only — never pricing inputs.
--
-- ROLLBACK: DROP FUNCTION public.create_priest_booking(uuid,date,text,text,text,text,text,uuid[]);
--   The old PriestMenu / Checkout direct-insert paths would then have to be
--   restored to keep priest bookings working; nothing else depends on this.
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
            ('priest_packages','id'), ('priest_packages','provider_id'),
            ('priest_packages','service_price'), ('priest_packages','advance_percentage'),
            ('priest_packages','status'), ('priest_packages','package_type'),
            ('priest_addons','id'), ('priest_addons','package_id'),
            ('priest_addons','price'),
            ('priest_bookings','id'), ('priest_bookings','customer_id'),
            ('priest_bookings','provider_id'), ('priest_bookings','package_id'),
            ('priest_bookings','event_date'), ('priest_bookings','event_time'),
            ('priest_bookings','event_type'), ('priest_bookings','venue'),
            ('priest_bookings','city'), ('priest_bookings','special_instructions'),
            ('priest_bookings','selected_addon_ids'),
            ('priest_bookings','base_amount'), ('priest_bookings','addons_amount'),
            ('priest_bookings','total_amount'), ('priest_bookings','advance_amount'),
            ('priest_bookings','remaining_amount'), ('priest_bookings','status'),
            ('priest_bookings','created_at')
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
        RAISE EXCEPTION 'ABORT create_priest_booking: live schema is missing expected column(s):%', v_missing;
    END IF;
    -- The package price must be a numeric type; if it drifted to text the
    -- server-side arithmetic below would behave unexpectedly.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_price_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.priest_packages'::regclass
       AND a.attname = 'service_price' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_price_typ IS NULL OR v_price_typ NOT LIKE 'numeric%' THEN
        RAISE EXCEPTION 'ABORT create_priest_booking: priest_packages.service_price is % (expected numeric).', v_price_typ;
    END IF;

    -- The advance rate must be an integer type (advance_percentage); a drift to
    -- text/float would change how the advance rounds.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_pct_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.priest_packages'::regclass
       AND a.attname = 'advance_percentage' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_pct_typ IS NULL OR v_pct_typ NOT LIKE 'integer%' THEN
        RAISE EXCEPTION 'ABORT create_priest_booking: priest_packages.advance_percentage is % (expected integer).', v_pct_typ;
    END IF;

    RAISE NOTICE 'OK: priest create schema matches; creating create_priest_booking.';
END $catalog$;
-- ===========================================================================
-- Server-authoritative priest booking CREATE. The browser passes ONLY
-- identifiers / selections / descriptive fields. Every financial value and the
-- customer identity are decided here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.create_priest_booking(
    p_package_id           uuid,
    p_event_date           date,
    p_event_time           text   DEFAULT NULL,
    p_event_type           text   DEFAULT NULL,
    p_venue                text   DEFAULT NULL,
    p_city                 text   DEFAULT NULL,
    p_special_instructions text   DEFAULT NULL,
    p_addon_ids            uuid[] DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid        uuid := auth.uid();
    v_pkg        public.priest_packages%rowtype;
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
      FROM public.priest_packages
     WHERE id = p_package_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Package not available' USING ERRCODE = 'P0002';
    END IF;
    -- Only an active package may be booked (mirrors PriestMenu, which lists only
    -- status = 'active' packages).
    IF v_pkg.status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'This service is not available for booking (status: %)', v_pkg.status
            USING ERRCODE = '22023';
    END IF;

    -- Base = the single service_price column. NOT the ancillary *_charges columns
    -- (travel/outside_city/extra_ritual/extra_hours) that the menu never totals.
    v_base := coalesce(v_pkg.service_price, 0);

    -- Addons = sum(price) of the passed addon ids that ACTUALLY belong to this
    -- package. Ids that do not belong are ignored (cannot borrow another package's
    -- addon, cannot inflate/deflate the total). NO is_active filter — PriestMenu
    -- fetches priest_addons(*) unfiltered, so this preserves its behavior. We
    -- persist only the validated ids, so selected_addon_ids can never claim an
    -- addon whose price the total did not include.
    SELECT coalesce(sum(a.price), 0),
           coalesce(array_agg(a.id ORDER BY a.id), '{}'::uuid[])
      INTO v_addons, v_valid_ids
      FROM public.priest_addons a
     WHERE a.package_id = v_pkg.id
       AND a.id = ANY (v_addon_ids);

    v_total := v_base + v_addons;

    -- Advance rate = the package's authoritative advance_percentage. Mirrors
    -- PriestMenu's Number(pkg.advance_percentage || 20): NULL or 0 -> 20.
    v_pct       := coalesce(nullif(v_pkg.advance_percentage, 0), 20);
    v_advance   := round(v_total * v_pct / 100.0);
    v_remaining := v_total - v_advance;
    -- customer_id is FORCED to the caller; provider_id is taken from the trusted
    -- package, never from client-supplied values. Advance / remaining are stored
    -- at creation (mirrors PriestMenu). event_type falls back to the package_type
    -- when the caller omits it (PriestMenu's eventType || pkg.package_type).
    -- event_type / venue / city / special_instructions are descriptive only.
    INSERT INTO public.priest_bookings (
        package_id, provider_id, customer_id,
        event_date, event_time, event_type,
        venue, city, special_instructions,
        selected_addon_ids,
        base_amount, addons_amount, total_amount,
        advance_amount, remaining_amount,
        status
    ) VALUES (
        v_pkg.id, v_pkg.provider_id, v_uid,
        p_event_date, p_event_time, coalesce(nullif(p_event_type, ''), v_pkg.package_type),
        p_venue, p_city, p_special_instructions,
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
REVOKE ALL ON FUNCTION public.create_priest_booking(uuid,date,text,text,text,text,text,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_priest_booking(uuid,date,text,text,text,text,text,uuid[]) TO authenticated;
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
     WHERE n.nspname = 'public' AND p.proname = 'create_priest_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 create_priest_booking overload, found %.', v_cnt;
    END IF;

    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_priest_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: create_priest_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: create_priest_booking has no hardened search_path (got %).', v_search;
    END IF;

    v_anon_exec := has_function_privilege('anon', 'public.create_priest_booking(uuid,date,text,text,text,text,text,uuid[])', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.create_priest_booking(uuid,date,text,text,text,text,text,uuid[])', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE create_priest_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE create_priest_booking.';
    END IF;

    RAISE NOTICE 'OK: create_priest_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
