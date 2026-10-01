-- 20261227000000_singer_booking_server_authoritative.sql
--
-- P0-1 (singer category): move booking financial authority off the browser.
--
-- BEFORE: src/components/SingerMenu.tsx (the "Book Now" modal) inserted directly
--   into public.singer_bookings with base_amount / addons_amount / total_amount /
--   advance_amount / remaining_amount taken from CLIENT-computed values, and the
--   generic cart path in src/pages/Checkout.tsx did the same via a dynamic-table
--   INSERT using a flat ADVANCE_PERCENT = 20. A tampered client could post any
--   amounts (e.g. total_amount = 1) and the row would persist them. (Singer's
--   columns venue / city / special_requirements DO exist, so unlike priest/rental
--   the generic cart INSERT was not additionally broken — but it used a flat 20%
--   advance instead of the package's advance_percentage, and it trusted amounts.)
--
-- AFTER: the browser calls public.create_singer_booking(...) passing ONLY
--   identifiers / selections / descriptive fields. This SECURITY DEFINER RPC
--   fetches the authoritative package price + addon prices server-side, derives
--   every financial value, forces customer_id = auth.uid(), and inserts
--   atomically. No financial value crosses the trust boundary from the browser.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes of the amount columns is parked separately
-- at supabase/migrations-pending/PHASE_singer_bookings_column_lockdown.sql and
-- must NOT be promoted until this RPC + the rewired frontend are live.
--
-- Formula reproduced EXACTLY from SingerMenu.tsx (P0-1 Step 7 — preserve business
-- logic; do not "fix" it here):
--   base    = coalesce(package_price, 0)   -- the SINGLE package_price column
--             (SingerMenu's Number(pkg.package_price || 0)). Singer has NO
--             quantity/multiplier — the total is package_price + addons.
--   addons  = sum(price) of the selected addons that belong to the package.
--             singer_addons has NO is_active column, and SingerMenu does not use
--             addons at all today (it inserts selected_addon_ids = [] and
--             addons_amount = 0). This RPC still sums any passed ids that belong
--             to the package (NO is_active filter), so the CURRENT flow yields 0
--             addons while a future addon-carrying caller is priced correctly.
--   total   = base + addons
--   advance = round(total * advance_percentage / 100)  -- SINGER HONORS the
--             package's per-package advance_percentage (integer DEFAULT 20), like
--             dancer/makeup/mehendi/priest/rental — NOT a hardcoded flat 20%.
--             Mirrors SingerMenu's Number(pkg.advance_percentage || 20): NULL or
--             0 -> 20.
--   remaining = total - advance
--   Singer STORES advance/remaining AT CREATION (mirrors SingerMenu, which writes
--   all five amounts at insert time — like dancer/priest/rental). event_type is
--   NOT defaulted to package_type (SingerMenu writes eventType || null with NO
--   fallback). event_type / venue / city / special_requirements are DESCRIPTIVE
--   fields only — never pricing inputs.
--
-- ROLLBACK: DROP FUNCTION public.create_singer_booking(uuid,date,text,text,text,text,text,uuid[]);
--   The old SingerMenu / Checkout direct-insert paths would then have to be
--   restored to keep singer bookings working; nothing else depends on this.
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
            ('singer_packages','id'), ('singer_packages','provider_id'),
            ('singer_packages','package_price'), ('singer_packages','advance_percentage'),
            ('singer_packages','status'),
            ('singer_addons','id'), ('singer_addons','package_id'),
            ('singer_addons','price'),
            ('singer_bookings','id'), ('singer_bookings','customer_id'),
            ('singer_bookings','provider_id'), ('singer_bookings','package_id'),
            ('singer_bookings','event_date'), ('singer_bookings','event_time'),
            ('singer_bookings','event_type'), ('singer_bookings','venue'),
            ('singer_bookings','city'), ('singer_bookings','special_requirements'),
            ('singer_bookings','selected_addon_ids'),
            ('singer_bookings','base_amount'), ('singer_bookings','addons_amount'),
            ('singer_bookings','total_amount'), ('singer_bookings','advance_amount'),
            ('singer_bookings','remaining_amount'), ('singer_bookings','status'),
            ('singer_bookings','created_at')
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
        RAISE EXCEPTION 'ABORT create_singer_booking: live schema is missing expected column(s):%', v_missing;
    END IF;
    -- The package price must be a numeric type; if it drifted to text the
    -- server-side arithmetic below would behave unexpectedly.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_price_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.singer_packages'::regclass
       AND a.attname = 'package_price' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_price_typ IS NULL OR v_price_typ NOT LIKE 'numeric%' THEN
        RAISE EXCEPTION 'ABORT create_singer_booking: singer_packages.package_price is % (expected numeric).', v_price_typ;
    END IF;

    -- The advance rate must be an integer type (advance_percentage); a drift to
    -- text/float would change how the advance rounds.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_pct_typ
      FROM pg_attribute a
     WHERE a.attrelid = 'public.singer_packages'::regclass
       AND a.attname = 'advance_percentage' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_pct_typ IS NULL OR v_pct_typ NOT LIKE 'integer%' THEN
        RAISE EXCEPTION 'ABORT create_singer_booking: singer_packages.advance_percentage is % (expected integer).', v_pct_typ;
    END IF;

    RAISE NOTICE 'OK: singer create schema matches; creating create_singer_booking.';
END $catalog$;
-- ===========================================================================
-- Server-authoritative singer booking CREATE. The browser passes ONLY
-- identifiers / selections / descriptive fields. Every financial value and the
-- customer identity are decided here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.create_singer_booking(
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
    v_pkg        public.singer_packages%rowtype;
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
      FROM public.singer_packages
     WHERE id = p_package_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Package not available' USING ERRCODE = 'P0002';
    END IF;
    -- Only an active package may be booked (mirrors SingerMenu, which lists only
    -- status = 'active' packages).
    IF v_pkg.status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'This service is not available for booking (status: %)', v_pkg.status
            USING ERRCODE = '22023';
    END IF;

    -- Base = the single package_price column. Singer has NO quantity/multiplier
    -- and NO ancillary charge columns the menu totals — base is just the price.
    v_base := coalesce(v_pkg.package_price, 0);

    -- Addons = sum(price) of the passed addon ids that ACTUALLY belong to this
    -- package. Ids that do not belong are ignored (cannot borrow another package's
    -- addon, cannot inflate/deflate the total). NO is_active filter — singer_addons
    -- has no such column. SingerMenu passes no addon ids today (selected_addon_ids
    -- = []), so the current flow yields 0 addons; a future addon-carrying caller is
    -- priced from the trusted rows. We persist only the validated ids, so
    -- selected_addon_ids can never claim an addon whose price the total omitted.
    SELECT coalesce(sum(a.price), 0),
           coalesce(array_agg(a.id ORDER BY a.id), '{}'::uuid[])
      INTO v_addons, v_valid_ids
      FROM public.singer_addons a
     WHERE a.package_id = v_pkg.id
       AND a.id = ANY (v_addon_ids);

    v_total := v_base + v_addons;

    -- Advance rate = the package's authoritative advance_percentage. Mirrors
    -- SingerMenu's Number(pkg.advance_percentage || 20): NULL or 0 -> 20.
    v_pct       := coalesce(nullif(v_pkg.advance_percentage, 0), 20);
    v_advance   := round(v_total * v_pct / 100.0);
    v_remaining := v_total - v_advance;
    -- customer_id is FORCED to the caller; provider_id is taken from the trusted
    -- package, never from client-supplied values. Advance / remaining are stored
    -- at creation (mirrors SingerMenu). event_type is NOT defaulted to package_type
    -- (SingerMenu writes eventType || null with no fallback). event_type / venue /
    -- city / special_requirements are descriptive only.
    INSERT INTO public.singer_bookings (
        package_id, provider_id, customer_id,
        event_date, event_time, event_type,
        venue, city, special_requirements,
        selected_addon_ids,
        base_amount, addons_amount, total_amount,
        advance_amount, remaining_amount,
        status
    ) VALUES (
        v_pkg.id, v_pkg.provider_id, v_uid,
        p_event_date, p_event_time, nullif(p_event_type, ''),
        p_venue, p_city, p_special_requirements,
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
REVOKE ALL ON FUNCTION public.create_singer_booking(uuid,date,text,text,text,text,text,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_singer_booking(uuid,date,text,text,text,text,text,uuid[]) TO authenticated;
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
     WHERE n.nspname = 'public' AND p.proname = 'create_singer_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 create_singer_booking overload, found %.', v_cnt;
    END IF;

    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_singer_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: create_singer_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: create_singer_booking has no hardened search_path (got %).', v_search;
    END IF;

    v_anon_exec := has_function_privilege('anon', 'public.create_singer_booking(uuid,date,text,text,text,text,text,uuid[])', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.create_singer_booking(uuid,date,text,text,text,text,text,uuid[])', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE create_singer_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE create_singer_booking.';
    END IF;

    RAISE NOTICE 'OK: create_singer_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
