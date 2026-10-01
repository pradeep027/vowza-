-- 20261238000000_category_bookings_status_transition_guard.sql
--
-- P0 Phase C (booking state machine) — FAN-OUT to the 15 per-vendor category
-- booking tables, following the generic-bookings pilot
-- (20261237000000_bookings_status_transition_guard.sql).
--
-- Unlike the generic public.bookings table (whose status is the booking_status
-- ENUM, created 'requested'), the 15 category *_bookings tables use a plain
-- `status text` column created 'pending'. They otherwise share ONE identical
-- lifecycle, so a SINGLE shared validator function
-- public.enforce_category_booking_status_transition() is attached to all 15 via
-- a BEFORE UPDATE OF status trigger each.
--
-- BEFORE: the only DB-enforced status guard on these tables was the per-category
--   accept RPC (pending -> accepted). Every other edge (pay-advance
--   accepted -> in_progress, complete in_progress -> completed, customer/vendor
--   cancel/decline) is a raw client `.from(table).update({status})` gated only
--   by RLS row-ownership — no value check, no WITH CHECK. A party could jump
--   pending -> completed, revive a terminal booking, or self-set 'accepted'.
--
-- LEGAL TRANSITION DAG (text labels; created 'pending'), a strict SUPERSET of
--   every transition the app performs on these tables:
--       pending     -> accepted | rejected | cancelled
--       accepted    -> in_progress | cancelled | rejected
--       in_progress -> completed | cancelled
--       completed / cancelled / rejected -> (terminal)
--   (Category decline writes 'cancelled'; 'rejected' is permitted as a harmless
--   superset edge. No app path writes 'expired'/'no_show' — verified.)
--
-- CLASSIFICATION: SECURITY FIX (blocks illegal/forged transitions on all 15
--   category tables) + BEHAVIOR PRESERVATION (no legitimate transition rejected;
--   a no-op status write passes; admins/super_admins bypass via has_role).
--   ADDITIVE and frontend-independent — installs one function + 15 triggers,
--   revokes nothing.
--
-- ROLLBACK (per table): DROP TRIGGER IF EXISTS trg_enforce_<t>_status_transition ON public.<t>;
--   then DROP FUNCTION IF EXISTS public.enforce_category_booking_status_transition();
BEGIN;

SET search_path = public, pg_temp;
-- ===========================================================================
-- FAIL-CLOSED DRIFT GUARD. Every one of the 15 category tables must exist and
-- carry a text `status` column, and the admin bypass's has_role() must exist,
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
    v_tbl  text;
    v_typ  text;
BEGIN
    FOREACH v_tbl IN ARRAY category_tables LOOP
        -- table exists (regclass throws if not) and has a `status` column.
        SELECT ty.typname INTO v_typ
          FROM pg_attribute a
          JOIN pg_type ty ON ty.oid = a.atttypid
         WHERE a.attrelid = ('public.' || v_tbl)::regclass
           AND a.attname = 'status' AND a.attnum > 0 AND NOT a.attisdropped;
        IF v_typ IS NULL THEN
            RAISE EXCEPTION 'ABORT category status guard: public.%.status does not exist.', v_tbl;
        END IF;
        -- These tables use plain text status ('pending' default), NOT the enum.
        IF v_typ <> 'text' THEN
            RAISE EXCEPTION 'ABORT category status guard: public.%.status is % , expected text.', v_tbl, v_typ;
        END IF;
    END LOOP;

    -- Resolve by signature with to_regprocedure rather than string-matching
    -- pg_get_function_identity_arguments: that catalog function renders app_role
    -- schema-qualified ('uuid, public.app_role') when it is not search_path-visible
    -- in the apply session, so an exact '= uuid, app_role' match false-aborts even
    -- though has_role exists (migration 20261204000000 calls it on this same DB).
    IF to_regprocedure('public.has_role(uuid, public.app_role)') IS NULL THEN
        RAISE EXCEPTION 'ABORT category status guard: public.has_role(uuid, app_role) not found.';
    END IF;

    RAISE NOTICE 'OK: all 15 category booking tables carry a text status column.';
END $catalog$;
-- ===========================================================================
-- Shared text-status validator. Identical DAG for all 15 category tables (each
-- created 'pending'). Hardened SECURITY DEFINER + empty search_path.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.enforce_category_booking_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_old text := OLD.status;
    v_new text := NEW.status;
BEGIN
    -- No-op status write (or any UPDATE re-sending the same value) passes.
    IF v_new IS NOT DISTINCT FROM v_old THEN
        RETURN NEW;
    END IF;

    -- Admins / super_admins may override the machine (dispute resolution).
    IF public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
        RETURN NEW;
    END IF;

    -- Legal transition DAG. Terminals (completed/cancelled/rejected) have no
    -- outgoing edge.
    IF (v_old = 'pending'     AND v_new IN ('accepted', 'rejected', 'cancelled'))
    OR (v_old = 'accepted'    AND v_new IN ('in_progress', 'cancelled', 'rejected'))
    OR (v_old = 'in_progress' AND v_new IN ('completed', 'cancelled'))
    THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION
        'Illegal booking status transition: % -> % (booking %)', v_old, v_new, OLD.id
        USING ERRCODE = '23514';
END $fn$;
-- ===========================================================================
-- Attach the shared validator to each of the 15 category tables.
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
            'DROP TRIGGER IF EXISTS trg_enforce_%1$s_status_transition ON public.%1$I',
            v_tbl
        );
        EXECUTE format(
            'CREATE TRIGGER trg_enforce_%1$s_status_transition '
            'BEFORE UPDATE OF status ON public.%1$I '
            'FOR EACH ROW EXECUTE FUNCTION public.enforce_category_booking_status_transition()',
            v_tbl
        );
    END LOOP;
END $install$;
-- ===========================================================================
-- FAIL-CLOSED SELF-CHECK. The shared function must be hardened, and every one
-- of the 15 tables must carry a row-level BEFORE UPDATE trigger bound to it.
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
BEGIN
    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'enforce_category_booking_status_transition';
    IF v_secdef IS NULL THEN
        RAISE EXCEPTION 'FAILED: enforce_category_booking_status_transition was not created.';
    END IF;
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: enforce_category_booking_status_transition is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: enforce_category_booking_status_transition has no hardened search_path (got %).', v_search;
    END IF;

    FOREACH v_tbl IN ARRAY category_tables LOOP
        SELECT (t.tgtype & 2) <> 0, (t.tgtype & 1) <> 0
          INTO v_before, v_row
          FROM pg_trigger t
         WHERE t.tgrelid = ('public.' || v_tbl)::regclass
           AND t.tgname = 'trg_enforce_' || v_tbl || '_status_transition'
           AND NOT t.tgisinternal;
        IF v_before IS NULL THEN
            RAISE EXCEPTION 'FAILED: status transition trigger missing on public.%.', v_tbl;
        END IF;
        IF NOT v_before OR NOT v_row THEN
            RAISE EXCEPTION 'FAILED: status transition trigger on public.% is not a row-level BEFORE trigger.', v_tbl;
        END IF;
    END LOOP;

    RAISE NOTICE 'OK: category booking status transition guard installed on all 15 tables.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';



