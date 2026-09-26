-- 20261209000000_anchor_booking_server_authoritative.sql
--
-- P0-1 (anchor category): move booking financial authority off the browser.
--
-- BEFORE: src/components/AnchorMenu.tsx (the "Book Now" modal) and the generic
--   cart path in src/pages/Checkout.tsx inserted directly into
--   public.anchor_bookings with base_amount / addons_amount / total_amount taken
--   from CLIENT-computed values. A tampered client could post any amounts
--   (e.g. total_amount = 1) and the row would persist them.
--
-- AFTER: the browser calls public.create_anchor_booking(...) passing ONLY
--   identifiers / selections / descriptive fields. This SECURITY DEFINER RPC
--   fetches the authoritative package price + addon prices server-side, derives
--   every financial value, forces customer_id = auth.uid(), and inserts
--   atomically. No financial value crosses the trust boundary from the browser.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes of the amount columns is parked separately
-- at supabase/migrations-pending/PHASE_anchor_bookings_column_lockdown.sql and
-- must NOT be promoted until this RPC + the rewired frontend are live.
--
-- Formula reproduced EXACTLY from AnchorMenu.tsx (P0-1 Step 4 — preserve business
-- logic; do not "fix" it here):
--   base    = coalesce(package_price, 0)   -- flat package price, NOT per-plate
--   addons  = sum(price) of the selected addons that belong to the package
--   total   = base + addons
--   Advance/remaining are NOT written at creation (mirrors AnchorMenu, which
--   stores only base/addons/total at insert time). They are derived at ACCEPT by
--   accept_anchor_booking from the STORED total. expected_audience is stored as a
--   descriptive field ONLY — it is not a pricing multiplier (the total is
--   package_price + addons regardless of the client count).
--
-- ROLLBACK: DROP FUNCTION public.create_anchor_booking(uuid,date,text,text,text,text,text,uuid[],text);
--   The old AnchorMenu / Checkout direct-insert paths would then have to be
--   restored to keep anchor bookings working; nothing else depends on this.

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
            ('anchor_packages','id'), ('anchor_packages','provider_id'),
            ('anchor_packages','package_price'), ('anchor_packages','status'),
            ('anchor_addons','id'), ('anchor_addons','package_id'), ('anchor_addons','price'),
            ('anchor_bookings','customer_id'), ('anchor_bookings','provider_id'),
            ('anchor_bookings','package_id'), ('anchor_bookings','base_amount'),
            ('anchor_bookings','addons_amount'), ('anchor_bookings','total_amount'),
            ('anchor_bookings','selected_addon_ids'), ('anchor_bookings','status'),
            ('anchor_bookings','event_date'), ('anchor_bookings','event_time'),
            ('anchor_bookings','event_type'), ('anchor_bookings','venue'),
            ('anchor_bookings','city'), ('anchor_bookings','expected_audience'),
            ('anchor_bookings','special_requirements')
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
        RAISE EXCEPTION 'ABORT create_anchor_booking: live schema is missing expected column(s):%', v_missing;
    END IF;

    -- (b) the three financial columns written here must be a numeric type.
    FOR req IN
        SELECT unnest(ARRAY['base_amount','addons_amount','total_amount']) AS col
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
             WHERE a.attrelid = 'public.anchor_bookings'::regclass
               AND a.attname = req.col
               AND ty.typname IN ('int2','int4','int8','numeric','float4','float8')
        ) THEN
            v_typebad := v_typebad || ' ' || req.col;
        END IF;
    END LOOP;
    IF v_typebad <> '' THEN
        RAISE EXCEPTION 'ABORT create_anchor_booking: anchor_bookings financial column(s) not numeric:%', v_typebad;
    END IF;

    RAISE NOTICE 'OK: anchor schema matches; creating create_anchor_booking.';
END $catalog$;

-- ===========================================================================
-- Server-authoritative anchor booking creation. The browser may pass
-- identifiers, selections and descriptive fields ONLY. Every financial value is
-- derived here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.create_anchor_booking(
    p_package_id           uuid,
    p_event_date           date,
    p_event_time           text  DEFAULT NULL,
    p_event_type           text  DEFAULT NULL,
    p_venue                text  DEFAULT NULL,
    p_city                 text  DEFAULT NULL,
    p_expected_audience    text  DEFAULT NULL,
    p_addon_ids            uuid[] DEFAULT '{}'::uuid[],
    p_special_requirements text  DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid    uuid := auth.uid();
    v_pkg    public.anchor_packages%rowtype;
    v_base   numeric;
    v_addons numeric;
    v_total  numeric;
    v_id     uuid;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
    END IF;
    IF p_event_date IS NULL THEN
        RAISE EXCEPTION 'Event date is required' USING ERRCODE = '22004';
    END IF;

    -- Authoritative package fetch. Only an ACTIVE anchor package is bookable
    -- (mirrors the client query .eq('status','active')). Row-locked so its price
    -- cannot change under us mid-transaction.
    SELECT * INTO v_pkg
      FROM public.anchor_packages
     WHERE id = p_package_id AND status = 'active'
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Anchor package not available' USING ERRCODE = 'P0002';
    END IF;
    -- Financials — derived from trusted rows, never from the request body.
    v_base := coalesce(v_pkg.package_price, 0);

    SELECT coalesce(sum(a.price), 0) INTO v_addons
      FROM public.anchor_addons a
     WHERE a.package_id = v_pkg.id
       AND a.id = ANY (coalesce(p_addon_ids, '{}'::uuid[]));

    v_total := v_base + v_addons;

    -- Advance/remaining are intentionally NOT written here: AnchorMenu stores
    -- only base/addons/total at creation and the advance is derived at accept
    -- (accept_anchor_booking) from this STORED total. expected_audience is a
    -- descriptive field only; it does not affect any amount.
    INSERT INTO public.anchor_bookings (
        package_id, provider_id, customer_id,
        event_date, event_time, event_type, venue, city, expected_audience,
        selected_addon_ids, special_requirements,
        base_amount, addons_amount, total_amount,
        status
    ) VALUES (
        v_pkg.id, v_pkg.provider_id, v_uid,
        p_event_date, nullif(p_event_time, ''), nullif(p_event_type, ''),
        nullif(p_venue, ''), nullif(p_city, ''), nullif(p_expected_audience, ''),
        coalesce(p_addon_ids, '{}'::uuid[]), nullif(p_special_requirements, ''),
        v_base, v_addons, v_total,
        'pending'
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END $fn$;

-- Callable only by signed-in users; never anon/public.
REVOKE ALL ON FUNCTION public.create_anchor_booking(uuid,date,text,text,text,text,text,uuid[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_anchor_booking(uuid,date,text,text,text,text,text,uuid[],text) TO authenticated;
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
     WHERE n.nspname = 'public' AND p.proname = 'create_anchor_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 create_anchor_booking overload, found %.', v_cnt;
    END IF;

    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_anchor_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: create_anchor_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: create_anchor_booking has no hardened search_path (got %).', v_search;
    END IF;

    v_anon_exec := has_function_privilege('anon', 'public.create_anchor_booking(uuid,date,text,text,text,text,text,uuid[],text)', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.create_anchor_booking(uuid,date,text,text,text,text,text,uuid[],text)', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE create_anchor_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE create_anchor_booking.';
    END IF;

    RAISE NOTICE 'OK: create_anchor_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
