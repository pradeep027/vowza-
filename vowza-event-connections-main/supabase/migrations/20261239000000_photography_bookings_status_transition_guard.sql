-- 20261239000000_photography_bookings_status_transition_guard.sql
--
-- P0 Phase C (booking state machine) — the last raw-status-write booking table:
-- public.photography_package_bookings. Like the 15 category tables it uses a
-- `status text` column created 'pending' and shares the identical lifecycle, so
-- it reuses the shared validator public.enforce_category_booking_status_transition()
-- installed by 20261238000000_category_bookings_status_transition_guard.sql.
--
-- WHY IT WAS EXPOSED: photography_package_bookings has customer + provider
-- UPDATE RLS policies (row-ownership only, no value check) and — like the
-- generic bookings table — NO accept RPC, so its accept ('accepted'),
-- pay-advance ('in_progress'), complete ('completed') and cancel ('cancelled')
-- edges are all raw client PATCHes. Its status CHECK also permits 'confirmed',
-- but no app path writes that value (it appears only in read-eligibility
-- checks), so the pending-source DAG below is a strict superset of every
-- transition the app performs.
--
-- NOTE ON admin_event_package_bookings (DELIBERATELY NOT GUARDED): that table's
-- only UPDATE policy is admin-only (no customer/provider UPDATE policy, and no
-- app path writes its status), so the sole writer is an admin — who bypasses
-- the state machine by design. A transition guard there would be a no-op.
--
-- CLASSIFICATION: SECURITY FIX + BEHAVIOR PRESERVATION. ADDITIVE — adds one
-- trigger reusing the existing shared function; revokes nothing.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_enforce_photography_package_bookings_status_transition
--       ON public.photography_package_bookings;
BEGIN;

SET search_path = public, pg_temp;
-- ===========================================================================
-- FAIL-CLOSED DRIFT GUARD: the table + its text status column + the shared
-- validator function must all exist before we attach the trigger.
-- ===========================================================================
DO $catalog$
DECLARE
    v_typ text;
BEGIN
    SELECT ty.typname INTO v_typ
      FROM pg_attribute a
      JOIN pg_type ty ON ty.oid = a.atttypid
     WHERE a.attrelid = 'public.photography_package_bookings'::regclass
       AND a.attname = 'status' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_typ IS NULL THEN
        RAISE EXCEPTION 'ABORT photography status guard: public.photography_package_bookings.status does not exist.';
    END IF;
    IF v_typ <> 'text' THEN
        RAISE EXCEPTION 'ABORT photography status guard: status is % , expected text.', v_typ;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'enforce_category_booking_status_transition'
    ) THEN
        RAISE EXCEPTION 'ABORT photography status guard: shared validator enforce_category_booking_status_transition() not found (apply 20261238000000 first).';
    END IF;

    RAISE NOTICE 'OK: photography_package_bookings carries a text status column; shared validator present.';
END $catalog$;
-- Attach the shared text-status validator.
DROP TRIGGER IF EXISTS trg_enforce_photography_package_bookings_status_transition
    ON public.photography_package_bookings;
CREATE TRIGGER trg_enforce_photography_package_bookings_status_transition
    BEFORE UPDATE OF status ON public.photography_package_bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_category_booking_status_transition();
-- ===========================================================================
-- FAIL-CLOSED SELF-CHECK: the trigger must be a row-level BEFORE trigger.
-- ===========================================================================
DO $verify$
DECLARE
    v_before boolean;
    v_row    boolean;
BEGIN
    SELECT (t.tgtype & 2) <> 0, (t.tgtype & 1) <> 0
      INTO v_before, v_row
      FROM pg_trigger t
     WHERE t.tgrelid = 'public.photography_package_bookings'::regclass
       AND t.tgname = 'trg_enforce_photography_package_bookings_status_transition'
       AND NOT t.tgisinternal;
    IF v_before IS NULL THEN
        RAISE EXCEPTION 'FAILED: photography status transition trigger was not installed.';
    END IF;
    IF NOT v_before OR NOT v_row THEN
        RAISE EXCEPTION 'FAILED: photography status transition trigger is not a row-level BEFORE trigger.';
    END IF;

    RAISE NOTICE 'OK: photography_package_bookings status transition guard installed.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';
