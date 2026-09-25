-- 20261205000000_band_booking_server_authoritative.sql
--
-- P0-1 PILOT (band category): move booking financial authority off the browser.
--
-- BEFORE: src/components/BandMenu.tsx inserted directly into public.band_bookings
--   with base_amount / addons_amount / total_amount / advance_amount /
--   remaining_amount taken from CLIENT-computed values. A tampered client could
--   post any amounts (e.g. total_amount = 1) and the row would persist them.
--
-- AFTER: the browser calls public.create_band_booking(...) passing ONLY
--   identifiers / selections / descriptive fields. This SECURITY DEFINER RPC
--   fetches the authoritative package price + addon prices server-side, derives
--   every financial value, forces customer_id = auth.uid(), and inserts
--   atomically. No financial value crosses the trust boundary from the browser.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes of the amount columns is parked separately
-- at supabase/migrations-pending/PHASE_band_bookings_column_lockdown.sql and
-- must NOT be promoted until this RPC + the rewired BandMenu are live.
--
-- Formula reproduced EXACTLY from BandMenu.tsx (P0-1 Step 4 — preserve business
-- logic; do not "fix" it here):
--   base      = coalesce(package_price, 0)
--   addons    = sum(price) of the selected addons that belong to the package
--   total     = base + addons
--   advance % = package.advance_percentage, but null OR 0 falls back to 20
--               (mirrors JS `Number(pkg.advance_percentage || 20)`)
--   advance   = round(total * advance% / 100)
--   remaining = total - advance
--
-- ROLLBACK: DROP FUNCTION public.create_band_booking(uuid,date,text,text,text,text,uuid[],text);
--   The old BandMenu direct-insert path would then have to be restored to keep
--   band bookings working; nothing else depends on this function.

BEGIN;

-- ===========================================================================
-- FAIL-CLOSED DRIFT GUARD. Introspect the LIVE schema and abort (rolling back
-- the whole migration) if the columns/types this RPC reads and writes are not
-- exactly what the repo snapshot assumes. Uses pg_attribute, not the repo.
-- ===========================================================================
DO $catalog$
DECLARE
    req   record;
    v_missing text := '';
    v_typebad text := '';
BEGIN
    -- (a) every column the RPC touches must exist.
    FOR req IN
        SELECT tbl, col FROM (VALUES
            ('band_packages','id'), ('band_packages','provider_id'),
            ('band_packages','package_price'), ('band_packages','advance_percentage'),
            ('band_packages','status'),
            ('band_addons','id'), ('band_addons','package_id'), ('band_addons','price'),
            ('band_bookings','customer_id'), ('band_bookings','provider_id'),
            ('band_bookings','package_id'), ('band_bookings','base_amount'),
            ('band_bookings','addons_amount'), ('band_bookings','total_amount'),
            ('band_bookings','advance_amount'), ('band_bookings','remaining_amount'),
            ('band_bookings','selected_addon_ids'), ('band_bookings','status'),
            ('band_bookings','event_date'), ('band_bookings','event_time'),
            ('band_bookings','event_type'), ('band_bookings','venue'),
            ('band_bookings','city'), ('band_bookings','special_requirements')
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
        RAISE EXCEPTION 'ABORT create_band_booking: live schema is missing expected column(s):%', v_missing;
    END IF;

    -- (b) the five financial columns must be a numeric type (server derivation
    --     writes numbers into them). Anything else is unexpected drift.
    FOR req IN
        SELECT unnest(ARRAY[
            'base_amount','addons_amount','total_amount','advance_amount','remaining_amount'
        ]) AS col
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
             WHERE a.attrelid = 'public.band_bookings'::regclass
               AND a.attname = req.col
               AND ty.typname IN ('int2','int4','int8','numeric','float4','float8')
        ) THEN
            v_typebad := v_typebad || ' ' || req.col;
        END IF;
    END LOOP;
    IF v_typebad <> '' THEN
        RAISE EXCEPTION 'ABORT create_band_booking: band_bookings financial column(s) not numeric:%', v_typebad;
    END IF;

    RAISE NOTICE 'OK: band schema matches; creating create_band_booking.';
END $catalog$;

-- ===========================================================================
-- Server-authoritative band booking creation. The browser may pass identifiers,
-- selections and descriptive fields ONLY. Every financial value is derived here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.create_band_booking(
    p_package_id           uuid,
    p_event_date           date,
    p_event_time           text  DEFAULT NULL,
    p_event_type           text  DEFAULT NULL,
    p_venue                text  DEFAULT NULL,
    p_city                 text  DEFAULT NULL,
    p_addon_ids            uuid[] DEFAULT '{}'::uuid[],
    p_special_requirements text  DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid       uuid := auth.uid();
    v_pkg       public.band_packages%rowtype;
    v_base      numeric;
    v_addons    numeric;
    v_total     numeric;
    v_pct       numeric;
    v_advance   numeric;
    v_remaining numeric;
    v_id        uuid;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
    END IF;
    IF p_event_date IS NULL THEN
        RAISE EXCEPTION 'Event date is required' USING ERRCODE = '22004';
    END IF;

    -- Authoritative package fetch. Only an ACTIVE band package is bookable
    -- (mirrors the client query .eq('status','active')). Row-locked so its price
    -- cannot change under us mid-transaction.
    SELECT * INTO v_pkg
      FROM public.band_packages
     WHERE id = p_package_id AND status = 'active'
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Band package not available' USING ERRCODE = 'P0002';
    END IF;

    -- Financials — derived from trusted rows, never from the request body.
    v_base := coalesce(v_pkg.package_price, 0);

    SELECT coalesce(sum(a.price), 0) INTO v_addons
      FROM public.band_addons a
     WHERE a.package_id = v_pkg.id
       AND a.id = ANY (coalesce(p_addon_ids, '{}'::uuid[]));

    v_total := v_base + v_addons;
    -- null OR 0 -> 20, matching `Number(pkg.advance_percentage || 20)`.
    v_pct       := coalesce(nullif(v_pkg.advance_percentage, 0), 20);
    v_advance   := round(v_total * v_pct / 100.0);
    v_remaining := v_total - v_advance;

    INSERT INTO public.band_bookings (
        package_id, provider_id, customer_id,
        event_date, event_time, event_type, venue, city,
        selected_addon_ids, special_requirements,
        base_amount, addons_amount, total_amount, advance_amount, remaining_amount,
        status
    ) VALUES (
        v_pkg.id, v_pkg.provider_id, v_uid,
        p_event_date, nullif(p_event_time, ''), nullif(p_event_type, ''),
        nullif(p_venue, ''), nullif(p_city, ''),
        coalesce(p_addon_ids, '{}'::uuid[]), nullif(p_special_requirements, ''),
        v_base, v_addons, v_total, v_advance, v_remaining,
        'pending'
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END $fn$;

-- Callable only by signed-in users; never anon/public.
REVOKE ALL ON FUNCTION public.create_band_booking(uuid,date,text,text,text,text,uuid[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_band_booking(uuid,date,text,text,text,text,uuid[],text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
