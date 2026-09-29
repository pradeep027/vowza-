-- 20261225000000_rental_booking_server_authoritative.sql
--
-- P0-1 (rental category): move booking financial authority off the browser.
--
-- BEFORE: src/components/RentalMenu.tsx (the "Book Now" modal) inserted directly
--   into public.rental_bookings with base_amount / addons_amount / total_amount /
--   advance_amount / remaining_amount taken from CLIENT-computed values, INCLUDING
--   a client-chosen quantity_required that MULTIPLIES the base (base = price x qty).
--   The generic cart path in src/pages/Checkout.tsx also carried client amounts and
--   wrote venue / special_requirements, columns rental_bookings LACKS (it has
--   delivery_address / city / special_instructions), so the cart path was already
--   broken for rental. A tampered client could post any amounts or any quantity.
--
-- AFTER: the browser calls public.create_rental_booking(...) passing ONLY
--   identifiers / selections / descriptive fields (including the requested
--   quantity). This SECURITY DEFINER RPC fetches the authoritative package price +
--   addon prices server-side, RE-MULTIPLIES base = price x quantity server-side,
--   derives every financial value, forces customer_id = auth.uid(), and inserts
--   atomically. No financial value crosses the trust boundary from the browser.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown is parked at
-- supabase/migrations-pending/PHASE_rental_bookings_column_lockdown.sql and must
-- NOT be promoted until this RPC + the rewired frontend are live.
--
-- Formula reproduced EXACTLY from RentalMenu.tsx (preserve business logic):
--   qty     = greatest(1, quantity_required)         -- RentalMenu's Math.max(1, qty)
--   base    = coalesce(price, 0) * qty                -- RENTAL IS THE ONLY CATEGORY
--             with a real quantity MULTIPLIER; quantity_required is a PRICING input,
--             not descriptive. NOT the ancillary *_charges columns (security_deposit /
--             transportation / installation / outside_city / extra_hour / late_return),
--             which rental_packages has but the menu NEVER adds to the total.
--   addons  = sum(price) of the selected addons that belong to the package (FLAT --
--             NOT multiplied by qty, mirroring RentalMenu). rental_addons HAS
--             is_active, but RentalMenu fetches rental_addons(*) unfiltered and sums
--             the selected ones, so this RPC sums the passed ids with NO is_active
--             filter (behavior preservation).
--   total   = base + addons
--   advance = round(total * advance_percentage / 100)  -- RENTAL HONORS the package's
--             per-package advance_percentage (integer DEFAULT 20), like
--             dancer/makeup/mehendi/priest. Mirrors Number(pkg.advance_percentage || 20).
--   remaining = total - advance
--   Rental STORES advance/remaining AT CREATION (mirrors RentalMenu, which writes
--   all five amounts at insert). event_type / rental_duration / delivery_address /
--   city / special_instructions are DESCRIPTIVE only -- never pricing inputs -- and
--   (unlike priest) event_type is NOT defaulted to package_type (RentalMenu stores
--   eventType || null). Availability is enforced server-side: qty may not exceed the
--   package's available_units when that is set (mirrors RentalMenu's qty guard).
--
-- ROLLBACK: DROP FUNCTION public.create_rental_booking(uuid,date,text,text,text,text,text,integer,text,uuid[]);
--   The old RentalMenu / Checkout direct-insert paths would then have to be restored
--   to keep rental bookings working; nothing else depends on this.
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
            ('rental_packages','id'), ('rental_packages','provider_id'),
            ('rental_packages','price'), ('rental_packages','advance_percentage'),
            ('rental_packages','status'), ('rental_packages','available_units'),
            ('rental_addons','id'), ('rental_addons','package_id'),
            ('rental_addons','price'),
            ('rental_bookings','id'), ('rental_bookings','customer_id'),
            ('rental_bookings','provider_id'), ('rental_bookings','package_id'),
            ('rental_bookings','event_date'), ('rental_bookings','event_time'),
            ('rental_bookings','event_type'), ('rental_bookings','rental_duration'),
            ('rental_bookings','delivery_address'), ('rental_bookings','city'),
            ('rental_bookings','quantity_required'),
            ('rental_bookings','special_instructions'),
            ('rental_bookings','selected_addon_ids'),
            ('rental_bookings','base_amount'), ('rental_bookings','addons_amount'),
            ('rental_bookings','total_amount'), ('rental_bookings','advance_amount'),
            ('rental_bookings','remaining_amount'), ('rental_bookings','status'),
            ('rental_bookings','created_at')
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
        RAISE EXCEPTION 'ABORT create_rental_booking: live schema is missing expected column(s):%', v_missing;
    END IF;
    -- The package price must be a numeric type; if it drifted to text the
    -- server-side arithmetic below (price * quantity) would behave unexpectedly.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_price_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.rental_packages'::regclass
       AND a.attname = 'price' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_price_typ IS NULL OR v_price_typ NOT LIKE 'numeric%' THEN
        RAISE EXCEPTION 'ABORT create_rental_booking: rental_packages.price is % (expected numeric).', v_price_typ;
    END IF;

    -- The advance rate must be an integer type (advance_percentage); a drift to
    -- text/float would change how the advance rounds.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_pct_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.rental_packages'::regclass
       AND a.attname = 'advance_percentage' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_pct_typ IS NULL OR v_pct_typ NOT LIKE 'integer%' THEN
        RAISE EXCEPTION 'ABORT create_rental_booking: rental_packages.advance_percentage is % (expected integer).', v_pct_typ;
    END IF;

    RAISE NOTICE 'OK: rental create schema matches; creating create_rental_booking.';
END $catalog$;
-- ===========================================================================
-- Server-authoritative rental booking CREATE. The browser passes ONLY
-- identifiers / selections / descriptive fields plus the requested quantity.
-- Every financial value and the customer identity are decided here, and the
-- base is RE-MULTIPLIED by the server-clamped quantity.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.create_rental_booking(
    p_package_id           uuid,
    p_event_date           date,
    p_event_time           text    DEFAULT NULL,
    p_event_type           text    DEFAULT NULL,
    p_rental_duration      text    DEFAULT NULL,
    p_delivery_address     text    DEFAULT NULL,
    p_city                 text    DEFAULT NULL,
    p_quantity_required    integer DEFAULT 1,
    p_special_instructions text    DEFAULT NULL,
    p_addon_ids            uuid[]  DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid        uuid := auth.uid();
    v_pkg        public.rental_packages%rowtype;
    v_qty        integer;
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
    -- Row-lock the package so its price / available_units cannot change under us.
    SELECT * INTO v_pkg
      FROM public.rental_packages
     WHERE id = p_package_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Package not available' USING ERRCODE = 'P0002';
    END IF;
    -- Only an active package may be booked (mirrors RentalMenu, which lists only
    -- status = 'active' packages).
    IF v_pkg.status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'This service is not available for booking (status: %)', v_pkg.status
            USING ERRCODE = '22023';
    END IF;

    -- Quantity is a PRICING input for rental (base = price * qty). Clamp to >= 1
    -- exactly like RentalMenu's Math.max(1, Number(quantityRequired) || 1); a
    -- client can never drive the multiplier below 1.
    v_qty := greatest(1, coalesce(p_quantity_required, 1));
    -- Enforce availability server-side (mirrors RentalMenu's qty > available_units
    -- guard). Only when available_units is set; a tampered client cannot book more
    -- units than exist.
    IF v_pkg.available_units IS NOT NULL AND v_qty > v_pkg.available_units THEN
        RAISE EXCEPTION 'Only % unit(s) available', v_pkg.available_units
            USING ERRCODE = '22023';
    END IF;
    -- Base = the single price column RE-MULTIPLIED by the server-clamped quantity.
    -- NOT the ancillary *_charges columns (security_deposit / transportation /
    -- installation / outside_city / extra_hour / late_return) that the menu never
    -- totals.
    v_base := coalesce(v_pkg.price, 0) * v_qty;

    -- Addons = FLAT sum(price) of the passed addon ids that ACTUALLY belong to this
    -- package (NOT multiplied by qty, mirroring RentalMenu). Ids that do not belong
    -- are ignored (cannot borrow another package's addon, cannot inflate/deflate the
    -- total). NO is_active filter -- RentalMenu fetches rental_addons(*) unfiltered,
    -- so this preserves its behavior. We persist only the validated ids.
    SELECT coalesce(sum(a.price), 0),
           coalesce(array_agg(a.id ORDER BY a.id), '{}'::uuid[])
      INTO v_addons, v_valid_ids
      FROM public.rental_addons a
     WHERE a.package_id = v_pkg.id
       AND a.id = ANY (v_addon_ids);

    v_total := v_base + v_addons;

    -- Advance rate = the package's authoritative advance_percentage. Mirrors
    -- RentalMenu's Number(pkg.advance_percentage || 20): NULL or 0 -> 20.
    v_pct       := coalesce(nullif(v_pkg.advance_percentage, 0), 20);
    v_advance   := round(v_total * v_pct / 100.0);
    v_remaining := v_total - v_advance;
    -- customer_id is FORCED to the caller; provider_id is taken from the trusted
    -- package, never from client-supplied values. quantity_required is stored as the
    -- server-clamped multiplier that produced base. Advance / remaining are stored at
    -- creation (mirrors RentalMenu). event_type / rental_duration / delivery_address /
    -- city / special_instructions are descriptive only; event_type is stored as-is
    -- (empty -> NULL), NOT defaulted to package_type (RentalMenu stores eventType||null).
    INSERT INTO public.rental_bookings (
        package_id, provider_id, customer_id,
        event_date, event_time, event_type, rental_duration,
        delivery_address, city, quantity_required,
        special_instructions, selected_addon_ids,
        base_amount, addons_amount, total_amount,
        advance_amount, remaining_amount,
        status
    ) VALUES (
        v_pkg.id, v_pkg.provider_id, v_uid,
        p_event_date, p_event_time, nullif(p_event_type, ''), p_rental_duration,
        p_delivery_address, p_city, v_qty,
        p_special_instructions, v_valid_ids,
        v_base, v_addons, v_total,
        v_advance, v_remaining,
        'pending'
    )
    RETURNING id INTO v_booking_id;

    RETURN v_booking_id;
END $fn$;
-- Callable only by signed-in users; never anon/public. The RPC itself forces
-- customer_id = auth.uid() and derives every amount.
REVOKE ALL ON FUNCTION public.create_rental_booking(uuid,date,text,text,text,text,text,integer,text,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_rental_booking(uuid,date,text,text,text,text,text,integer,text,uuid[]) TO authenticated;
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
     WHERE n.nspname = 'public' AND p.proname = 'create_rental_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 create_rental_booking overload, found %.', v_cnt;
    END IF;

    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_rental_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: create_rental_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: create_rental_booking has no hardened search_path (got %).', v_search;
    END IF;

    v_anon_exec := has_function_privilege('anon', 'public.create_rental_booking(uuid,date,text,text,text,text,text,integer,text,uuid[])', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.create_rental_booking(uuid,date,text,text,text,text,text,integer,text,uuid[])', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE create_rental_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE create_rental_booking.';
    END IF;

    RAISE NOTICE 'OK: create_rental_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';





