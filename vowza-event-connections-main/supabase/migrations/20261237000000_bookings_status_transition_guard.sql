-- 20261237000000_bookings_status_transition_guard.sql
--
-- P0 Phase C (booking state machine) — PILOT on the generic public.bookings
-- table. Make the booking status lifecycle a server-enforced state machine so a
-- signed-in row party can no longer drive `status` to an arbitrary value by a
-- direct PATCH.
--
-- BEFORE: RLS on public.bookings gates only WHO may UPDATE a row (the owning
--   customer OR the owning provider) — it never inspects the status VALUE and
--   there is no WITH CHECK. So an authenticated party could PATCH status
--   requested -> completed (skipping accept + pay-advance), revive a terminal
--   completed/cancelled/rejected booking, or a customer could self-set
--   'accepted'. The only existing guard is the per-category accept RPCs, which
--   the generic bookings table does not even have.
--
-- AFTER: a BEFORE UPDATE OF status trigger validates every status change against
--   the legal transition DAG below and REJECTS anything else. Terminal states
--   have no outgoing edges. A no-op (status unchanged) always passes, so updates
--   to other columns are unaffected. Admins / super_admins bypass the machine
--   (dispute resolution), matching how has_role() is used elsewhere.
--
-- LEGAL TRANSITION DAG (generic bookings uses the booking_status enum, created
--   as 'requested'), a strict SUPERSET of every transition the app performs
--   today (traced: ProviderDashboard accept/reject, MyBookings pay-advance ->
--   in_progress, completeService in_progress -> completed, customer/vendor
--   cancel, service-start OTP -> in_progress):
--       requested   -> accepted | rejected | cancelled
--       accepted    -> in_progress | cancelled | rejected
--       in_progress -> completed | cancelled
--       completed   -> (terminal)
--       cancelled   -> (terminal)
--       rejected    -> (terminal)
--   Every legitimate flow stays legal; only illegal jumps and terminal-state
--   reversion are newly blocked.
--
-- CLASSIFICATION: SECURITY FIX (blocks illegal/forged status transitions) +
--   BEHAVIOR PRESERVATION (no legitimate transition is rejected; admins bypass).
--   This is ADDITIVE and safe to apply on its own — it adds a trigger and a
--   function, revokes nothing, and is independent of any frontend deploy (a
--   legal transition is legal regardless of the served bundle version).
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_enforce_bookings_status_transition ON public.bookings;
--   DROP FUNCTION IF EXISTS public.enforce_bookings_status_transition();
BEGIN;

SET search_path = public, pg_temp;
-- ===========================================================================
-- FAIL-CLOSED DRIFT GUARD. Prove the pieces this trigger depends on exist and
-- have the expected shape before we install it. Abort (rolling back the whole
-- migration) on ANY drift.
-- ===========================================================================
DO $catalog$
DECLARE
    v_typ text;
BEGIN
    -- (a) public.bookings.status must exist and be the booking_status enum —
    --     the DAG below is written in that enum's labels.
    SELECT ty.typname INTO v_typ
      FROM pg_attribute a
      JOIN pg_type ty ON ty.oid = a.atttypid
     WHERE a.attrelid = 'public.bookings'::regclass
       AND a.attname = 'status' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_typ IS NULL THEN
        RAISE EXCEPTION 'ABORT bookings status guard: public.bookings.status does not exist.';
    END IF;
    IF v_typ <> 'booking_status' THEN
        RAISE EXCEPTION 'ABORT bookings status guard: public.bookings.status is % , expected enum booking_status.', v_typ;
    END IF;

    -- (b) every enum label the DAG references must exist on booking_status, so a
    --     silently-renamed label can never make a branch dead (fail-closed).
    FOR v_typ IN
        SELECT unnest(ARRAY['requested','accepted','in_progress','completed','cancelled','rejected'])
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'booking_status' AND e.enumlabel = v_typ
        ) THEN
            RAISE EXCEPTION 'ABORT bookings status guard: booking_status is missing label %.', v_typ;
        END IF;
    END LOOP;

    -- (c) the admin bypass depends on public.has_role(uuid, app_role).
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'has_role'
           AND pg_get_function_identity_arguments(p.oid) = 'uuid, app_role'
    ) THEN
        RAISE EXCEPTION 'ABORT bookings status guard: public.has_role(uuid, app_role) not found.';
    END IF;

    RAISE NOTICE 'OK: bookings status guard preconditions satisfied.';
END $catalog$;
-- ===========================================================================
-- The state-machine validator. Runs as a BEFORE UPDATE OF status trigger, so it
-- only fires when a statement writes the status column; updates that leave
-- status untouched never reach it. SECURITY DEFINER + empty search_path so the
-- has_role() lookup is unaffected by the caller's search_path.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.enforce_bookings_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_old public.booking_status := OLD.status;
    v_new public.booking_status := NEW.status;
BEGIN
    -- A no-op status write (or any UPDATE that re-sends the same value) always
    -- passes — this keeps benign column updates that also touch status working.
    IF v_new IS NOT DISTINCT FROM v_old THEN
        RETURN NEW;
    END IF;

    -- Admins / super_admins may override the machine (e.g. dispute resolution).
    IF public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
        RETURN NEW;
    END IF;

    -- Legal transition DAG. Terminal states (completed/cancelled/rejected) have
    -- no outgoing edges, so any change out of them falls through to the raise.
    IF (v_old = 'requested'   AND v_new IN ('accepted', 'rejected', 'cancelled'))
    OR (v_old = 'accepted'    AND v_new IN ('in_progress', 'cancelled', 'rejected'))
    OR (v_old = 'in_progress' AND v_new IN ('completed', 'cancelled'))
    THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION
        'Illegal booking status transition: % -> % (booking %)', v_old, v_new, OLD.id
        USING ERRCODE = '23514';
END $fn$;

DROP TRIGGER IF EXISTS trg_enforce_bookings_status_transition ON public.bookings;
CREATE TRIGGER trg_enforce_bookings_status_transition
    BEFORE UPDATE OF status ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_bookings_status_transition();
-- ===========================================================================
-- FAIL-CLOSED SELF-CHECK. Prove the function and trigger landed exactly as
-- intended (hardened function; a row-level BEFORE UPDATE trigger on bookings).
-- ===========================================================================
DO $verify$
DECLARE
    v_secdef boolean;
    v_search text;
    v_before boolean;
    v_row    boolean;
BEGIN
    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'enforce_bookings_status_transition';
    IF v_secdef IS NULL THEN
        RAISE EXCEPTION 'FAILED: enforce_bookings_status_transition was not created.';
    END IF;
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: enforce_bookings_status_transition is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: enforce_bookings_status_transition has no hardened search_path (got %).', v_search;
    END IF;

    -- (tgtype bit 0x02 = BEFORE, bit 0x01 = ROW-level; see pg_trigger).
    SELECT (t.tgtype & 2) <> 0, (t.tgtype & 1) <> 0
      INTO v_before, v_row
      FROM pg_trigger t
     WHERE t.tgrelid = 'public.bookings'::regclass
       AND t.tgname = 'trg_enforce_bookings_status_transition'
       AND NOT t.tgisinternal;
    IF v_before IS NULL THEN
        RAISE EXCEPTION 'FAILED: trg_enforce_bookings_status_transition is not attached to public.bookings.';
    END IF;
    IF NOT v_before OR NOT v_row THEN
        RAISE EXCEPTION 'FAILED: trg_enforce_bookings_status_transition is not a row-level BEFORE trigger.';
    END IF;

    RAISE NOTICE 'OK: bookings status transition guard installed (SECURITY DEFINER, row-level BEFORE UPDATE).';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';



