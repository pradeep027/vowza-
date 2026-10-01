-- 20261231000000_water_booking_server_authoritative.sql
--
-- P0-1 (water category): move booking financial authority off the browser.
--
-- BEFORE: src/components/WaterSupplyMenu.tsx (the "Book Now" modal) inserted
--   directly into public.water_bookings with base_amount / addons_amount /
--   total_amount / advance_amount / remaining_amount taken from CLIENT-computed
--   values, and the generic cart path in src/pages/Checkout.tsx did the same via
--   a dynamic-table INSERT using a flat ADVANCE_PERCENT = 20. Worse, the cart
--   added water with price = Number(pkg.package_price || pkg.price || 0) — but
--   water_packages has NEITHER column (its price is base_price), so the cart path
--   created ZERO-amount water bookings. A tampered client could also post any
--   amounts (e.g. total_amount = 1) via the menu and the row would persist them.
--
-- AFTER: the browser calls public.create_water_booking(...) passing ONLY
--   identifiers / selections / descriptive fields. This SECURITY DEFINER RPC
--   fetches the authoritative package price + addon prices server-side, derives
--   every financial value, forces customer_id = auth.uid(), and inserts
--   atomically. No financial value crosses the trust boundary from the browser.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes of the amount columns is parked separately
-- at supabase/migrations-pending/PHASE_water_bookings_column_lockdown.sql and
-- must NOT be promoted until this RPC + the rewired frontend are live.
--
-- Formula reproduced EXACTLY from WaterSupplyMenu.tsx (P0-1 Step 7 — preserve
-- business logic; do not "fix" it here):
--   base    = coalesce(base_price, 0)   -- the SINGLE base_price column
--             (WaterSupplyMenu's Number(pkg.base_price || 0)). Water has NO
--             quantity/multiplier: quantity_required is FREE TEXT (a delivery
--             note like "20 cans"), never a pricing input — the total is
--             base_price + addons. The package's transportation_charges /
--             outside_city_charges / night_delivery_charges /
--             emergency_delivery_charges / additional_tank_charges /
--             discount_percentage are NOT totalled by the menu, so they are NOT
--             totalled here.
--   addons  = sum(price) of the selected addons that belong to the package.
--             water_addons HAS an is_active column, but — matching the band pilot
--             / singer / videography convention — this RPC does NOT filter on it:
--             the id must belong to the package, and the price is taken from the
--             trusted row. WaterSupplyMenu loads water_addons(*) with NO is_active
--             filter and lets the user select, so summing the passed
--             package-owned ids reproduces the menu exactly. Unlike singer/
--             videography, water addons ARE live in the UI (real add-on picker).
--   total   = base + addons
--   advance = round(total * advance_percentage / 100)  -- WATER HONORS the
--             package's per-package advance_percentage (integer DEFAULT 20), like
--             dancer/makeup/mehendi/priest/rental/singer/videography — NOT a
--             hardcoded flat 20%. Mirrors WaterSupplyMenu's
--             Number(pkg.advance_percentage || 20): NULL or 0 -> 20.
--   remaining = total - advance
--   Water STORES advance/remaining AT CREATION (mirrors WaterSupplyMenu, which
--   writes all five amounts at insert time — like dancer/priest/rental/singer/
--   videography). event_type FALLS BACK to package_type (WaterSupplyMenu writes
--   eventType || pkg.package_type || null — like priest, UNLIKE singer/
--   videography). event_type / delivery_time / delivery_address / city /
--   quantity_required / special_instructions are DESCRIPTIVE fields only — never
--   pricing inputs.
--
-- ROLLBACK: DROP FUNCTION public.create_water_booking(uuid,date,text,text,text,text,text,text,uuid[]);
--   The old WaterSupplyMenu / Checkout direct-insert paths would then have to be
--   restored to keep water bookings working; nothing else depends on this.
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
            ('water_packages','id'), ('water_packages','provider_id'),
            ('water_packages','base_price'), ('water_packages','advance_percentage'),
            ('water_packages','package_type'), ('water_packages','status'),
            ('water_addons','id'), ('water_addons','package_id'),
            ('water_addons','price'),
            ('water_bookings','id'), ('water_bookings','customer_id'),
            ('water_bookings','provider_id'), ('water_bookings','package_id'),
            ('water_bookings','event_date'), ('water_bookings','delivery_time'),
            ('water_bookings','event_type'), ('water_bookings','delivery_address'),
            ('water_bookings','city'), ('water_bookings','quantity_required'),
            ('water_bookings','special_instructions'),
            ('water_bookings','selected_addon_ids'),
            ('water_bookings','base_amount'), ('water_bookings','addons_amount'),
            ('water_bookings','total_amount'), ('water_bookings','advance_amount'),
            ('water_bookings','remaining_amount'), ('water_bookings','status'),
            ('water_bookings','created_at')
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
        RAISE EXCEPTION 'ABORT create_water_booking: live schema is missing expected column(s):%', v_missing;
    END IF;
    -- The package price must be a numeric type; if it drifted to text the
    -- server-side arithmetic below would behave unexpectedly.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_price_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.water_packages'::regclass
       AND a.attname = 'base_price' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_price_typ IS NULL OR v_price_typ NOT LIKE 'numeric%' THEN
        RAISE EXCEPTION 'ABORT create_water_booking: water_packages.base_price is % (expected numeric).', v_price_typ;
    END IF;
    -- The advance rate must be an integer type (advance_percentage); a drift to
    -- text/float would change how the advance rounds.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_pct_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.water_packages'::regclass
       AND a.attname = 'advance_percentage' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_pct_typ IS NULL OR v_pct_typ NOT LIKE 'integer%' THEN
        RAISE EXCEPTION 'ABORT create_water_booking: water_packages.advance_percentage is % (expected integer).', v_pct_typ;
    END IF;

    RAISE NOTICE 'OK: water create schema matches; creating create_water_booking.';
END $catalog$;
-- ===========================================================================
-- Server-authoritative water booking CREATE. The browser passes ONLY
-- identifiers / selections / descriptive fields. Every financial value and the
-- customer identity are decided here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.create_water_booking(
    p_package_id           uuid,
    p_event_date           date,
    p_delivery_time        text   DEFAULT NULL,
    p_event_type           text   DEFAULT NULL,
    p_delivery_address     text   DEFAULT NULL,
    p_city                 text   DEFAULT NULL,
    p_quantity_required    text   DEFAULT NULL,
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
    v_pkg        public.water_packages%rowtype;
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
        RAISE EXCEPTION 'A delivery date is required' USING ERRCODE = '22023';
    END IF;
    -- Row-lock the package so its price cannot change under us mid-insert.
    SELECT * INTO v_pkg
      FROM public.water_packages
     WHERE id = p_package_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Package not available' USING ERRCODE = 'P0002';
    END IF;
    -- Only an active package may be booked (mirrors WaterSupplyMenu, which lists
    -- only status = 'active' packages).
    IF v_pkg.status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'This service is not available for booking (status: %)', v_pkg.status
            USING ERRCODE = '22023';
    END IF;
    -- Base = the single base_price column. Water has NO quantity/multiplier
    -- (quantity_required is a free-text delivery note) and NO ancillary charge
    -- columns the menu totals — base is just base_price.
    v_base := coalesce(nullif(v_pkg.base_price, 0), 0);

    -- Addons = sum(price) of the passed addon ids that ACTUALLY belong to this
    -- package. Ids that do not belong are ignored (cannot borrow another package's
    -- addon, cannot inflate/deflate the total). NO is_active filter — water_addons
    -- HAS an is_active column, but WaterSupplyMenu loads water_addons(*) unfiltered
    -- and the passed ids are exactly what the user picked, so summing the passed
    -- package-owned ids reproduces the menu. We persist only the validated ids, so
    -- selected_addon_ids can never claim an addon whose price the total omitted.
    SELECT coalesce(sum(a.price), 0),
           coalesce(array_agg(a.id ORDER BY a.id), '{}'::uuid[])
      INTO v_addons, v_valid_ids
      FROM public.water_addons a
     WHERE a.package_id = v_pkg.id
       AND a.id = ANY (v_addon_ids);

    v_total := v_base + v_addons;

    -- Advance rate = the package's authoritative advance_percentage. Mirrors
    -- WaterSupplyMenu's Number(pkg.advance_percentage || 20): NULL or 0 -> 20.
    v_pct       := coalesce(nullif(v_pkg.advance_percentage, 0), 20);
    v_advance   := round(v_total * v_pct / 100.0);
    v_remaining := v_total - v_advance;
    -- customer_id is FORCED to the caller; provider_id is taken from the trusted
    -- package, never from client-supplied values. Advance / remaining are stored
    -- at creation (mirrors WaterSupplyMenu). event_type FALLS BACK to package_type
    -- (WaterSupplyMenu writes eventType || pkg.package_type || null). event_type /
    -- delivery_time / delivery_address / city / quantity_required /
    -- special_instructions are descriptive only.
    INSERT INTO public.water_bookings (
        package_id, provider_id, customer_id,
        event_date, delivery_time, event_type,
        delivery_address, city, quantity_required, special_instructions,
        selected_addon_ids,
        base_amount, addons_amount, total_amount,
        advance_amount, remaining_amount,
        status
    ) VALUES (
        v_pkg.id, v_pkg.provider_id, v_uid,
        p_event_date, nullif(p_delivery_time, ''),
        coalesce(nullif(p_event_type, ''), nullif(v_pkg.package_type, '')),
        nullif(p_delivery_address, ''), nullif(p_city, ''),
        nullif(p_quantity_required, ''), nullif(p_special_instructions, ''),
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
REVOKE ALL ON FUNCTION public.create_water_booking(uuid,date,text,text,text,text,text,text,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_water_booking(uuid,date,text,text,text,text,text,text,uuid[]) TO authenticated;
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
     WHERE n.nspname = 'public' AND p.proname = 'create_water_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 create_water_booking overload, found %.', v_cnt;
    END IF;

    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_water_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: create_water_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: create_water_booking has no hardened search_path (got %).', v_search;
    END IF;

    v_anon_exec := has_function_privilege('anon', 'public.create_water_booking(uuid,date,text,text,text,text,text,text,uuid[])', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.create_water_booking(uuid,date,text,text,text,text,text,text,uuid[])', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE create_water_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE create_water_booking.';
    END IF;

    RAISE NOTICE 'OK: create_water_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
