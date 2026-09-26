-- 20261207000000_catering_booking_server_authoritative.sql
--
-- P0-1 (catering category): move booking financial authority off the browser.
-- Follows the band pilot (20261205000000) but adapts to catering's schema:
-- catering prices PER PLATE and the base scales with guest_count, whereas band
-- prices a flat package. Nothing here copies band's package_price assumption.
--
-- BEFORE: src/pages/CateringCartPage.tsx (reached via the CateringBookingModal
--   "Book Now" flow) inserted directly into public.catering_bookings with
--   base_amount / addons_amount / total_amount taken from CLIENT-computed values
--   (guest_count * price_per_plate + addon prices). A tampered client could post
--   any amounts and the row would persist them. The generic cart checkout
--   (src/pages/Checkout.tsx) had a second, broken direct-insert path for catering.
--
-- AFTER: the browser calls public.create_catering_booking(...) passing ONLY
--   identifiers / selections / the guest COUNT (an order quantity, never a price)
--   and descriptive fields. This SECURITY DEFINER RPC fetches the authoritative
--   per-plate price + addon prices server-side, derives every financial value,
--   forces customer_id = auth.uid(), and inserts atomically. No financial value
--   crosses the trust boundary from the browser.
--
-- This migration is ADDITIVE and safe to apply on its own: it only creates a
-- function and grants EXECUTE. It does NOT revoke anything. The BREAKING column
-- lockdown that stops direct PATCHes / INSERTs is parked separately at
-- supabase/migrations-pending/PHASE_catering_bookings_column_lockdown.sql and
-- must NOT be promoted until this RPC + the accept RPC + the rewired frontend
-- are live.
--
-- Formula reproduced EXACTLY from CateringBookingModal.tsx / CateringCartPage.tsx
-- (preserve business logic; do not "fix" it here):
--   base      = guest_count * coalesce(price_per_plate, 0)
--   addons    = sum(price) of the selected addons that belong to the package
--   total     = base + addons
--   advance   is NOT set at creation (stays at its column default, exactly as the
--             current cart insert leaves it); it is derived at accept time by
--             accept_catering_booking as a flat 20% of the STORED total.
--
-- ROLLBACK: DROP FUNCTION public.create_catering_booking(uuid,date,integer,text,text,text,text,text,uuid[]);
--   The old CateringCartPage direct-insert path would then have to be restored to
--   keep catering bookings working; nothing else depends on this function.

BEGIN;

-- =============================================================================
-- SCHEMA DRIFT GUARD. Runs BEFORE the function is (re)created. Fails the whole
-- migration if the live catering_* schema is not what create_catering_booking
-- reads from and writes to, so the RPC can never silently derive against columns
-- that moved or changed numeric type. Reproduces the band pilot's fail-closed
-- posture, adapted to catering's per-plate columns.
-- =============================================================================
DO $catalog$
DECLARE
    -- columns create_catering_booking INSERTs into catering_bookings
    need_bookings text[] := ARRAY[
        'customer_id','provider_id','package_id','event_type','event_date',
        'guest_count','meal_type','venue','city','special_requests',
        'selected_addon_ids','base_amount','addons_amount','total_amount','status'
    ];
    -- columns it reads from catering_packages
    need_packages text[] := ARRAY['id','provider_id','price_per_plate','status'];
    -- columns it reads from catering_addons
    need_addons   text[] := ARRAY['id','package_id','price'];
    -- financial + quantity columns that MUST be a numeric family type
    numeric_cols  text[] := ARRAY['base_amount','addons_amount','total_amount','guest_count'];
    c        text;
    v_type   text;
BEGIN
    FOREACH c IN ARRAY need_bookings LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute
             WHERE attrelid = 'public.catering_bookings'::regclass
               AND attname = c AND attnum > 0 AND NOT attisdropped
        ) THEN
            RAISE EXCEPTION 'ABORT create_catering_booking: catering_bookings.% is missing.', c;
        END IF;
    END LOOP;

    FOREACH c IN ARRAY need_packages LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute
             WHERE attrelid = 'public.catering_packages'::regclass
               AND attname = c AND attnum > 0 AND NOT attisdropped
        ) THEN
            RAISE EXCEPTION 'ABORT create_catering_booking: catering_packages.% is missing.', c;
        END IF;
    END LOOP;

    FOREACH c IN ARRAY need_addons LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute
             WHERE attrelid = 'public.catering_addons'::regclass
               AND attname = c AND attnum > 0 AND NOT attisdropped
        ) THEN
            RAISE EXCEPTION 'ABORT create_catering_booking: catering_addons.% is missing.', c;
        END IF;
    END LOOP;

    -- every financial/quantity column must be a numeric family type, else a
    -- text column could silently coerce and store junk as an "amount".
    FOREACH c IN ARRAY numeric_cols LOOP
        SELECT t.typname INTO v_type
          FROM pg_attribute a
          JOIN pg_type t ON t.oid = a.atttypid
         WHERE a.attrelid = 'public.catering_bookings'::regclass AND a.attname = c;
        IF v_type NOT IN ('int2','int4','int8','numeric','float4','float8') THEN
            RAISE EXCEPTION 'ABORT create_catering_booking: catering_bookings.% is % (expected a numeric type).', c, v_type;
        END IF;
    END LOOP;

    -- price_per_plate on the package must also be numeric.
    SELECT t.typname INTO v_type
      FROM pg_attribute a
      JOIN pg_type t ON t.oid = a.atttypid
     WHERE a.attrelid = 'public.catering_packages'::regclass AND a.attname = 'price_per_plate';
    IF v_type NOT IN ('int2','int4','int8','numeric','float4','float8') THEN
        RAISE EXCEPTION 'ABORT create_catering_booking: catering_packages.price_per_plate is % (expected numeric).', v_type;
    END IF;

    -- catering_addons.price must be numeric.
    SELECT t.typname INTO v_type
      FROM pg_attribute a
      JOIN pg_type t ON t.oid = a.atttypid
     WHERE a.attrelid = 'public.catering_addons'::regclass AND a.attname = 'price';
    IF v_type NOT IN ('int2','int4','int8','numeric','float4','float8') THEN
        RAISE EXCEPTION 'ABORT create_catering_booking: catering_addons.price is % (expected numeric).', v_type;
    END IF;
END $catalog$;

CREATE OR REPLACE FUNCTION public.create_catering_booking(
    p_package_id        uuid,
    p_event_date        date,
    p_guest_count       integer,
    p_event_type        text   DEFAULT NULL,
    p_meal_type         text   DEFAULT NULL,
    p_venue             text   DEFAULT NULL,
    p_city              text   DEFAULT NULL,
    p_special_requests  text   DEFAULT NULL,
    p_addon_ids         uuid[] DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid       uuid := auth.uid();
    v_pkg       public.catering_packages%ROWTYPE;
    v_base      numeric;
    v_addons    numeric;
    v_total     numeric;
    v_booking   uuid;
BEGIN
    -- Identity comes from the JWT, never from a parameter. A caller can only ever
    -- create a booking as themselves.
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
    END IF;

    -- Guest count is the ONLY quantity the client supplies. It is an order size,
    -- not a price. Reproduce the client-side min-of-1 expectation; the per-plate
    -- price and the package guest bounds are enforced from trusted rows below.
    IF p_guest_count IS NULL OR p_guest_count < 1 THEN
        RAISE EXCEPTION 'Guest count must be at least 1' USING ERRCODE = '22023';
    END IF;

    -- Authoritative package row. Only an ACTIVE package can be booked (mirrors the
    -- client status filter). FOR UPDATE pins the price row for this transaction.
    SELECT * INTO v_pkg
      FROM public.catering_packages
     WHERE id = p_package_id AND status = 'active'
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Catering package not found or not active' USING ERRCODE = '22023';
    END IF;

    -- base = guest_count * per-plate price  (CateringBookingModal / CateringCartPage)
    v_base := p_guest_count::numeric * coalesce(v_pkg.price_per_plate, 0);

    -- addons = sum of the selected addons that ACTUALLY belong to this package.
    -- Membership is enforced by package_id so a client cannot smuggle in a cheaper
    -- (or negative) addon from another package. No is_active filter — this matches
    -- the current client, which sums whatever addon rows it was shown.
    SELECT coalesce(sum(a.price), 0) INTO v_addons
      FROM public.catering_addons a
     WHERE a.package_id = v_pkg.id
       AND a.id = ANY(coalesce(p_addon_ids, '{}'::uuid[]));

    v_total := v_base + v_addons;

    -- Insert atomically. advance_amount / remaining_amount are intentionally left
    -- to their column defaults here (exactly as CateringCartPage does today); they
    -- are derived at accept time by accept_catering_booking. selected_addon_ids
    -- records only the addons that passed the package-membership filter.
    INSERT INTO public.catering_bookings (
        customer_id, provider_id, package_id,
        event_type, event_date, guest_count, meal_type,
        venue, city, special_requests,
        selected_addon_ids,
        base_amount, addons_amount, total_amount,
        status
    ) VALUES (
        v_uid, v_pkg.provider_id, v_pkg.id,
        p_event_type, p_event_date, p_guest_count, p_meal_type,
        p_venue, p_city, p_special_requests,
        (SELECT coalesce(array_agg(a.id), '{}'::uuid[])
           FROM public.catering_addons a
          WHERE a.package_id = v_pkg.id
            AND a.id = ANY(coalesce(p_addon_ids, '{}'::uuid[]))),
        v_base, v_addons, v_total,
        'pending'
    )
    RETURNING id INTO v_booking;

    RETURN v_booking;
END;
$fn$;

-- Only a signed-in user may create a booking. anon / public can never call it.
REVOKE ALL ON FUNCTION public.create_catering_booking(uuid,date,integer,text,text,text,text,text,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_catering_booking(uuid,date,integer,text,text,text,text,text,uuid[]) TO authenticated;

-- Fail-closed self-check: prove the function exists with the security posture we
-- intended (SECURITY DEFINER, empty search_path, callable by authenticated only).
DO $verify$
DECLARE
    v_oid  oid;
    v_sec  boolean;
    v_cfg  text[];
BEGIN
    SELECT p.oid, p.prosecdef, p.proconfig INTO v_oid, v_sec, v_cfg
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_catering_booking';

    IF v_oid IS NULL THEN
        RAISE EXCEPTION 'ABORT create_catering_booking: function not found after create.';
    END IF;
    IF NOT v_sec THEN
        RAISE EXCEPTION 'ABORT create_catering_booking: function is not SECURITY DEFINER.';
    END IF;
    IF v_cfg IS NULL OR NOT ('search_path=' = ANY(v_cfg)) THEN
        RAISE EXCEPTION 'ABORT create_catering_booking: search_path is not locked to empty.';
    END IF;
    IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'ABORT create_catering_booking: anon can EXECUTE (must be authenticated only).';
    END IF;
    IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'ABORT create_catering_booking: authenticated cannot EXECUTE.';
    END IF;

    RAISE NOTICE 'OK: create_catering_booking is SECURITY DEFINER, search_path locked, authenticated-only.';
END $verify$;

COMMIT;

-- PostgREST caches the schema; without this the new RPC is not callable until the
-- next DDL event.
NOTIFY pgrst, 'reload schema';



