-- 20261235000000_admin_event_package_booking_server_authoritative.sql
--
-- P0-1 (admin event-package bookings): move booking financial authority off the
-- browser. This is the curated Silver/Gold/Platinum event-PACKAGE booking flow
-- (public.admin_event_package_bookings), NOT one of the 15 per-vendor category
-- tables. It is admin-fulfilled and has no provider_id column.
--
-- BEFORE: src/hooks/useEventPackages.ts (useCreateEventPackageBooking, called by
--   src/components/EventPackageSelector.tsx's "Book Package Now") inserted
--   directly into public.admin_event_package_bookings with package_price /
--   discount_applied / final_price taken from CLIENT-held values
--   (selectedPackage.base_price / .discount_percentage / .final_price). RLS only
--   checked customer_id = auth.uid() (policy admin_event_package_bookings_customer_insert),
--   so a tampered client could book a Platinum package yet post final_price = 1.
--   The "pricing snapshot locked at purchase time" was NOT actually locked to the
--   authoritative package.
--
-- AFTER: the browser calls public.create_admin_event_package_booking(...) passing
--   ONLY the package id + descriptive event fields. This SECURITY DEFINER RPC
--   fetches the authoritative admin_event_packages row server-side, derives the
--   pricing snapshot, forces customer_id = auth.uid(), and inserts atomically.
--   No financial value crosses the trust boundary from the browser.
--
-- There is NO vendor accept step for these bookings (admin-fulfilled; the table
-- has no provider_id), so — unlike the 15 vendor categories — there is NO
-- companion accept_* RPC. Confirmation/payment status transitions stay with the
-- existing admin flow.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes/INSERTs of the amount columns is parked
-- separately at
-- supabase/migrations-pending/PHASE_admin_event_package_bookings_column_lockdown.sql
-- and must NOT be promoted until this RPC + the rewired frontend are live.
--
-- Formula reproduced EXACTLY from EventPackageSelector.tsx / useEventPackages.ts
-- (P0-1 — preserve business logic; do not "fix" it here):
--   package_price    = admin_event_packages.base_price   (snapshot "list price")
--   discount_applied = coalesce(discount_percentage, 0)  (percent, 0-100)
--   final_price      = admin_event_packages.final_price  (a GENERATED STORED
--                      column = base_price * (1 - discount_percentage/100); the
--                      RPC falls back to that same arithmetic if it is ever NULL).
--   There are NO addons and NO quantity multiplier for these packages.
--   EventPackageSelector's "remove up to 2 optional inclusions" is DISPLAY-only —
--   calculateFinalPrice() returns final_price unchanged — so removed inclusions do
--   NOT alter the price and are not persisted. status='pending',
--   payment_status='unpaid' at creation (mirrors the old insert). event_location /
--   guest_count are descriptive only, never pricing inputs.
--
-- ROLLBACK: DROP FUNCTION public.create_admin_event_package_booking(uuid,date,text,integer);
--   The old useEventPackages direct-insert path would then have to be restored to
--   keep these bookings working; nothing else depends on this.
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
    v_base_typ  text;
    v_disc_typ  text;
    v_final_typ text;
BEGIN
    FOR req IN
        SELECT tbl, col FROM (VALUES
            ('admin_event_packages','id'), ('admin_event_packages','base_price'),
            ('admin_event_packages','discount_percentage'),
            ('admin_event_packages','final_price'), ('admin_event_packages','is_active'),
            ('admin_event_package_bookings','id'),
            ('admin_event_package_bookings','customer_id'),
            ('admin_event_package_bookings','package_id'),
            ('admin_event_package_bookings','event_date'),
            ('admin_event_package_bookings','event_location'),
            ('admin_event_package_bookings','guest_count'),
            ('admin_event_package_bookings','package_price'),
            ('admin_event_package_bookings','discount_applied'),
            ('admin_event_package_bookings','final_price'),
            ('admin_event_package_bookings','status'),
            ('admin_event_package_bookings','payment_status'),
            ('admin_event_package_bookings','created_at')
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
        RAISE EXCEPTION 'ABORT create_admin_event_package_booking: live schema is missing expected column(s):%', v_missing;
    END IF;
    -- Every pricing column the RPC reads must be numeric; a drift to text would
    -- make the server-side arithmetic behave unexpectedly.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_base_typ
      FROM pg_attribute a WHERE a.attrelid = 'public.admin_event_packages'::regclass
       AND a.attname = 'base_price' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_base_typ IS NULL OR v_base_typ NOT LIKE 'numeric%' THEN
        RAISE EXCEPTION 'ABORT create_admin_event_package_booking: admin_event_packages.base_price is % (expected numeric).', v_base_typ;
    END IF;
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_disc_typ
      FROM pg_attribute a WHERE a.attrelid = 'public.admin_event_packages'::regclass
       AND a.attname = 'discount_percentage' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_disc_typ IS NULL OR v_disc_typ NOT LIKE 'numeric%' THEN
        RAISE EXCEPTION 'ABORT create_admin_event_package_booking: admin_event_packages.discount_percentage is % (expected numeric).', v_disc_typ;
    END IF;
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_final_typ
      FROM pg_attribute a WHERE a.attrelid = 'public.admin_event_packages'::regclass
       AND a.attname = 'final_price' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_final_typ IS NULL OR v_final_typ NOT LIKE 'numeric%' THEN
        RAISE EXCEPTION 'ABORT create_admin_event_package_booking: admin_event_packages.final_price is % (expected numeric).', v_final_typ;
    END IF;

    RAISE NOTICE 'OK: admin event-package create schema matches; creating create_admin_event_package_booking.';
END $catalog$;
-- ===========================================================================
-- Server-authoritative admin event-package booking CREATE. The browser passes
-- ONLY the package id + descriptive event fields. Every financial value and the
-- customer identity are decided here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.create_admin_event_package_booking(
    p_package_id     uuid,
    p_event_date     date,
    p_event_location text    DEFAULT NULL,
    p_guest_count    integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid        uuid := auth.uid();
    v_pkg        public.admin_event_packages%rowtype;
    v_price      numeric;
    v_discount   numeric;
    v_final      numeric;
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
      FROM public.admin_event_packages
     WHERE id = p_package_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Package not available' USING ERRCODE = 'P0002';
    END IF;
    -- Only an active package may be booked (mirrors useEventPackagesByEventType,
    -- which lists only is_active = true packages to customers).
    IF coalesce(v_pkg.is_active, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'This package is not available for booking' USING ERRCODE = '22023';
    END IF;
    -- Pricing snapshot, all derived from the authoritative package row:
    --   package_price    = base_price; discount_applied = discount_percentage;
    --   final_price      = the GENERATED final_price column (= base_price *
    --                      (1 - discount_percentage/100)), with the same
    --                      arithmetic as a defensive fallback if it is ever NULL.
    v_price    := coalesce(v_pkg.base_price, 0);
    v_discount := coalesce(v_pkg.discount_percentage, 0);
    v_final    := coalesce(v_pkg.final_price, round(v_price * (1 - v_discount / 100.0), 2));
    -- customer_id is FORCED to the caller; every financial value comes from the
    -- trusted package, never from client-supplied values. status/payment_status
    -- match the old insert. event_location / guest_count are descriptive only.
    INSERT INTO public.admin_event_package_bookings (
        customer_id, package_id,
        event_date, event_location, guest_count,
        package_price, discount_applied, final_price,
        status, payment_status
    ) VALUES (
        v_uid, v_pkg.id,
        p_event_date, nullif(p_event_location, ''), p_guest_count,
        v_price, v_discount, v_final,
        'pending', 'unpaid'
    )
    RETURNING id INTO v_booking_id;

    RETURN v_booking_id;
END $fn$;
-- Callable only by signed-in users; never anon/public. The RPC itself forces
-- customer_id = auth.uid() and derives every financial value.
REVOKE ALL ON FUNCTION public.create_admin_event_package_booking(uuid,date,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_admin_event_package_booking(uuid,date,text,integer) TO authenticated;
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
     WHERE n.nspname = 'public' AND p.proname = 'create_admin_event_package_booking';
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAILED: expected exactly 1 create_admin_event_package_booking overload, found %.', v_cnt;
    END IF;
    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_admin_event_package_booking';
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: create_admin_event_package_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: create_admin_event_package_booking has no hardened search_path (got %).', v_search;
    END IF;

    v_anon_exec := has_function_privilege('anon', 'public.create_admin_event_package_booking(uuid,date,text,integer)', 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', 'public.create_admin_event_package_booking(uuid,date,text,integer)', 'EXECUTE');
    IF v_anon_exec THEN
        RAISE EXCEPTION 'FAILED: anon can EXECUTE create_admin_event_package_booking.';
    END IF;
    IF NOT v_auth_exec THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot EXECUTE create_admin_event_package_booking.';
    END IF;

    RAISE NOTICE 'OK: create_admin_event_package_booking is SECURITY DEFINER, hardened, authenticated-only.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
