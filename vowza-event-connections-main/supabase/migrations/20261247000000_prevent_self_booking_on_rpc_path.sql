-- ===========================================================================
-- 20261247000000_prevent_self_booking_on_rpc_path.sql        [SECURITY FIX +
--                                                             BEHAVIOR PRESERVATION]
--
-- THE HOLE (REGRESSION INTRODUCED BY OUR OWN PHASE B REWRITE):
--   The universal self-booking rule -- "a vendor/artist CANNOT book their own
--   package" -- was enforced in production ONLY as per-table INSERT RLS policies
--   (supabase/migrations-archive/20260918000000_prevent_self_booking.sql:
--     WITH CHECK (customer_id = auth.uid()
--                 AND NOT EXISTS (SELECT 1 FROM provider_profiles
--                                  WHERE id = provider_id AND user_id = auth.uid())))
--   Phase B then moved booking CREATION off the browser INSERT and onto
--   per-category public.create_<cat>_booking(...) functions. Those are
--   SECURITY DEFINER, so they run as the function owner and BYPASS RLS entirely
--   -- including the self-booking INSERT policy. Each RPC forces
--   customer_id = auth.uid() and copies provider_id from the trusted package, but
--   NONE of them checks that the caller does not own that provider. Verified in
--   create_dancer_booking (20261213000000) and create_catering_booking
--   (20261207000000): no owner check. Net effect: on the live RPC path a vendor
--   can book their own package again -- the production rule was silently dropped.
--
-- SCOPE (exactly the 15 categories that received a Phase B create_*_booking RPC
--   AND carried a self-booking INSERT policy in the applied baseline):
--     band, catering, anchor, decorator, dancer, dj, drone, makeup, mehendi,
--     priest, rental, singer, videography, water, banquet  (all use provider_id).
--   OUT OF SCOPE (documented, deliberately NOT touched):
--     * photography_package_bookings -- NOT rewired to a SECURITY DEFINER RPC in
--       Phase B (still a direct authenticated INSERT), so its archived
--       photographer_id self-booking INSERT policy STILL fires. No RPC bypass =
--       no regression here; adding a trigger would need its photographer
--       ownership model confirmed separately.
--     * generic public.bookings and admin_event_package_bookings -- never had a
--       self-booking rule in the baseline (admin-curated / generic path); nothing
--       to restore.
--
-- THE FIX (additive, fail-closed, frontend-independent -- mirrors the Phase C
--   category-trigger idiom 20261238000000):
--   1. One shared SECURITY DEFINER trigger function
--      public.enforce_booking_no_self_booking() that RAISEs 42501 when the
--      authenticated caller owns the provider_profile being booked.
--   2. A BEFORE INSERT ROW trigger bound to it on each of the 15 tables. This
--      fires on the SECURITY DEFINER RPC path (triggers are NOT bypassed by
--      SECURITY DEFINER) and on any residual direct INSERT, so the rule holds on
--      every creation path.
--   3. Catalog drift guard (every table + provider_id must exist; provider_profiles
--      must carry id/user_id) and a fail-closed self-check (function hardened;
--      a row-level BEFORE INSERT trigger present on all 15 tables).
--
-- WHY APPLY-PATH (not parked): a LEGITIMATE customer is never the owner of the
--   provider they book, so no real booking flow is rejected -- only the forbidden
--   self-booking is. This RESTORES a rule that was already live, so it is
--   BEHAVIOR PRESERVATION for every legitimate path and a SECURITY FIX for the
--   bypass. No deploy ordering is required.
--
-- NOTE: service_role / trusted-backend inserts have auth.uid() = NULL and are
--   never treated as self-bookings (left to the RPCs' own identity forcing).
--
-- ROLLBACK (per table):
--   DROP TRIGGER IF EXISTS trg_prevent_<t>_self_booking ON public.<t>;
--   then DROP FUNCTION IF EXISTS public.enforce_booking_no_self_booking();
-- ===========================================================================

BEGIN;

SET search_path = public, pg_temp;

-- ===========================================================================
-- FAIL-CLOSED DRIFT GUARD. Every one of the 15 category tables must exist and
-- carry a `provider_id uuid` column, and provider_profiles must carry id/user_id,
-- before we install anything. Abort (rolling back) on ANY drift.
-- ===========================================================================
DO $catalog$
DECLARE
    category_tables text[] := ARRAY[
        'band_bookings','catering_bookings','anchor_bookings','decorator_bookings',
        'dancer_bookings','dj_bookings','drone_bookings','makeup_bookings',
        'mehendi_bookings','priest_bookings','rental_bookings','singer_bookings',
        'videography_bookings','water_bookings','banquet_bookings'
    ];
    v_tbl text;
    v_typ text;
BEGIN
    FOREACH v_tbl IN ARRAY category_tables LOOP
        -- table exists (regclass throws if not) and has a `provider_id` column.
        SELECT ty.typname INTO v_typ
          FROM pg_attribute a
          JOIN pg_type ty ON ty.oid = a.atttypid
         WHERE a.attrelid = ('public.' || v_tbl)::regclass
           AND a.attname = 'provider_id' AND a.attnum > 0 AND NOT a.attisdropped;
        IF v_typ IS NULL THEN
            RAISE EXCEPTION 'ABORT self-booking guard: public.%.provider_id does not exist.', v_tbl;
        END IF;
        IF v_typ <> 'uuid' THEN
            RAISE EXCEPTION 'ABORT self-booking guard: public.%.provider_id is %, expected uuid.', v_tbl, v_typ;
        END IF;
    END LOOP;

    -- The ownership source. Both columns the predicate reads must exist.
    PERFORM 1 FROM pg_attribute
     WHERE attrelid = 'public.provider_profiles'::regclass
       AND attname = 'id' AND attnum > 0 AND NOT attisdropped;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ABORT self-booking guard: public.provider_profiles.id does not exist.';
    END IF;
    PERFORM 1 FROM pg_attribute
     WHERE attrelid = 'public.provider_profiles'::regclass
       AND attname = 'user_id' AND attnum > 0 AND NOT attisdropped;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ABORT self-booking guard: public.provider_profiles.user_id does not exist.';
    END IF;

    RAISE NOTICE 'OK: all 15 category booking tables carry a uuid provider_id column.';
END $catalog$;
-- ===========================================================================
-- Shared self-booking validator. provider_id is guaranteed to exist on every
-- attached table by the drift guard, so NEW.provider_id resolves per-row across
-- all 15 rowtypes (same cross-table pattern as the Phase C status validator).
-- Hardened SECURITY DEFINER + empty search_path: the provider_profiles lookup
-- always sees the truth (fail-closed) regardless of RLS, and -- critically --
-- fires on the SECURITY DEFINER create_*_booking RPC path, which bypasses the
-- INSERT RLS policy that used to carry this rule.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.enforce_booking_no_self_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid uuid := auth.uid();
BEGIN
    -- No authenticated subject (service_role / trusted backend / unauthenticated
    -- path) => never a self-booking; leave to the other guards (RLS, the RPCs,
    -- which already force customer_id = auth.uid()).
    IF v_uid IS NULL THEN
        RETURN NEW;
    END IF;

    -- Block only a PROVEN self-booking: the caller owns the provider_profile
    -- being booked. A legitimate customer is never that owner, so no real
    -- booking is rejected. Mirrors the production INSERT-RLS rule
    -- (20260918000000_prevent_self_booking.sql) that the RPCs bypass.
    IF NEW.provider_id IS NOT NULL
       AND EXISTS (
           SELECT 1 FROM public.provider_profiles
            WHERE id = NEW.provider_id AND user_id = v_uid
       ) THEN
        RAISE EXCEPTION
            'Self-booking is not allowed: a provider cannot book their own package.'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END $fn$;
-- ===========================================================================
-- Attach the shared validator to each of the 15 category tables as a row-level
-- BEFORE INSERT trigger (triggers are NOT bypassed by SECURITY DEFINER RPCs).
-- ===========================================================================
DO $install$
DECLARE
    category_tables text[] := ARRAY[
        'band_bookings','catering_bookings','anchor_bookings','decorator_bookings',
        'dancer_bookings','dj_bookings','drone_bookings','makeup_bookings',
        'mehendi_bookings','priest_bookings','rental_bookings','singer_bookings',
        'videography_bookings','water_bookings','banquet_bookings'
    ];
    v_tbl text;
BEGIN
    FOREACH v_tbl IN ARRAY category_tables LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_prevent_%1$s_self_booking ON public.%1$I',
            v_tbl
        );
        EXECUTE format(
            'CREATE TRIGGER trg_prevent_%1$s_self_booking '
            'BEFORE INSERT ON public.%1$I '
            'FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_no_self_booking()',
            v_tbl
        );
    END LOOP;
END $install$;
-- ===========================================================================
-- FAIL-CLOSED SELF-CHECK. The shared function must be hardened, and every one
-- of the 15 tables must carry a row-level BEFORE INSERT trigger bound to it.
-- ===========================================================================
DO $verify$
DECLARE
    category_tables text[] := ARRAY[
        'band_bookings','catering_bookings','anchor_bookings','decorator_bookings',
        'dancer_bookings','dj_bookings','drone_bookings','makeup_bookings',
        'mehendi_bookings','priest_bookings','rental_bookings','singer_bookings',
        'videography_bookings','water_bookings','banquet_bookings'
    ];
    v_tbl    text;
    v_secdef boolean;
    v_search text;
    v_before boolean;
    v_row    boolean;
    v_insert boolean;
BEGIN
    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'enforce_booking_no_self_booking';
    IF v_secdef IS NULL THEN
        RAISE EXCEPTION 'FAILED: enforce_booking_no_self_booking was not created.';
    END IF;
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: enforce_booking_no_self_booking is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: enforce_booking_no_self_booking has no hardened search_path (got %).', v_search;
    END IF;

    FOREACH v_tbl IN ARRAY category_tables LOOP
        SELECT (t.tgtype & 2) <> 0, (t.tgtype & 1) <> 0, (t.tgtype & 4) <> 0
          INTO v_before, v_row, v_insert
          FROM pg_trigger t
         WHERE t.tgrelid = ('public.' || v_tbl)::regclass
           AND t.tgname = 'trg_prevent_' || v_tbl || '_self_booking'
           AND NOT t.tgisinternal;
        IF v_before IS NULL THEN
            RAISE EXCEPTION 'FAILED: self-booking trigger missing on public.%.', v_tbl;
        END IF;
        IF NOT v_before OR NOT v_row OR NOT v_insert THEN
            RAISE EXCEPTION 'FAILED: self-booking trigger on public.% is not a row-level BEFORE INSERT trigger.', v_tbl;
        END IF;
    END LOOP;

    RAISE NOTICE 'OK: self-booking guard installed on all 15 category tables.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
