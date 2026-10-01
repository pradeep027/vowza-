-- 20261241000000_category_actor_binding_photographer_fix.sql
--
-- P0 Phase C (booking state machine) — BUG FIX to the actor binding shipped in
-- 20261240000000_booking_status_transition_actor_binding.sql.
--
-- THE BUG: the shared category validator enforce_category_booking_status_transition()
-- resolves the actor with
--     public.booking_transition_actor_allowed(OLD.customer_id, OLD.provider_id, ...)
-- but that one function is attached to SIXTEEN tables, and one of them —
-- public.photography_package_bookings — names its provider column
-- `photographer_id`, NOT `provider_id` (every other category *_bookings table
-- does use `provider_id`). plpgsql resolves OLD.provider_id at RUNTIME per row,
-- so the function body loads fine, but the first non-bypassed status transition
-- on a photography booking (customer pay-advance, photographer accept/complete,
-- either-party cancel) raised `record "old" has no field "provider_id"` (SQLSTATE
-- 42703) and the UPDATE was rejected. The DAG check ran before the actor check
-- and never touched provider_id, so legal-value validation still worked; only
-- the actor step tripped.
--
-- THE FIX: re-define the shared category validator (CREATE OR REPLACE; all 16
-- triggers pick up the new body) to resolve BOTH ids generically from
-- to_jsonb(OLD) — provider id is coalesce(provider_id, photographer_id) — so the
-- single shared function works across the heterogeneous provider-column naming
-- without referencing a column that a given table lacks. Logic, order and the
-- bypass are otherwise identical to 20261240000000. The generic bookings
-- validator (enforce_bookings_status_transition) is unaffected: public.bookings
-- has a real provider_id column, so it keeps its direct OLD.provider_id read.
--
-- CLASSIFICATION: BUG FIX (restores legitimate photography status transitions
--   that 20261240000000 inadvertently broke) + SECURITY PRESERVATION (the actor
--   binding is now actually enforced on photography instead of erroring out).
--   ADDITIVE — re-defines one existing function; adds/revokes nothing else.
--
-- NOT RUNTIME-VERIFIABLE here (no live DB): proven statically + by this
--   migration's own $catalog$/$verify$ at APPLY time.
--
-- ROLLBACK: re-apply the 20261240000000 body of
--   enforce_category_booking_status_transition() (the OLD.provider_id version).
BEGIN;

SET search_path = public, pg_temp;
-- ===========================================================================
-- FAIL-CLOSED DRIFT GUARD: the shared validator + the actor helper must already
-- exist, and the heterogeneous provider columns must be exactly as this fix
-- assumes (photography uses photographer_id; a category table uses provider_id).
-- ===========================================================================
DO $catalog$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'enforce_category_booking_status_transition'
    ) THEN
        RAISE EXCEPTION 'ABORT photographer fix: enforce_category_booking_status_transition() missing (apply 20261238000000 + 20261240000000 first).';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'booking_transition_actor_allowed'
    ) THEN
        RAISE EXCEPTION 'ABORT photographer fix: booking_transition_actor_allowed() missing (apply 20261240000000 first).';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_attribute a
         WHERE a.attrelid = 'public.photography_package_bookings'::regclass
           AND a.attname = 'photographer_id' AND a.attnum > 0 AND NOT a.attisdropped
    ) THEN
        RAISE EXCEPTION 'ABORT photographer fix: photography_package_bookings.photographer_id not found.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_attribute a
         WHERE a.attrelid = 'public.band_bookings'::regclass
           AND a.attname = 'provider_id' AND a.attnum > 0 AND NOT a.attisdropped
    ) THEN
        RAISE EXCEPTION 'ABORT photographer fix: band_bookings.provider_id not found.';
    END IF;

    RAISE NOTICE 'OK: photographer-fix preconditions satisfied.';
END $catalog$;
-- ===========================================================================
-- Re-define the shared CATEGORY validator so it resolves both ids generically
-- from to_jsonb(OLD). provider id = coalesce(provider_id, photographer_id), so
-- the single trigger function serves photography_package_bookings (photographer_id)
-- and the 15 provider_id category tables alike. Bypass + DAG unchanged.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.enforce_category_booking_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_old         text  := OLD.status;
    v_new         text  := NEW.status;
    v_row         jsonb := to_jsonb(OLD);
    v_customer_id uuid  := (v_row ->> 'customer_id')::uuid;
    v_provider_id uuid  := coalesce(v_row ->> 'provider_id', v_row ->> 'photographer_id')::uuid;
BEGIN
    IF v_new IS NOT DISTINCT FROM v_old THEN
        RETURN NEW;
    END IF;

    IF auth.uid() IS NULL
       OR public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
        RETURN NEW;
    END IF;

    IF NOT (
        (v_old = 'pending'     AND v_new IN ('accepted', 'rejected', 'cancelled'))
     OR (v_old = 'accepted'    AND v_new IN ('in_progress', 'cancelled', 'rejected'))
     OR (v_old = 'in_progress' AND v_new IN ('completed', 'cancelled'))
    ) THEN
        RAISE EXCEPTION
            'Illegal booking status transition: % -> % (booking %)', v_old, v_new, OLD.id
            USING ERRCODE = '23514';
    END IF;

    IF NOT public.booking_transition_actor_allowed(
            v_customer_id, v_provider_id, v_old, v_new) THEN
        RAISE EXCEPTION
            'Not authorized to change booking status % -> % (booking %)', v_old, v_new, OLD.id
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END $fn$;
-- ===========================================================================
-- FAIL-CLOSED SELF-CHECK: the re-defined validator stays hardened.
-- ===========================================================================
DO $verify$
DECLARE
    v_secdef boolean;
    v_search text;
BEGIN
    SELECT p.prosecdef, array_to_string(p.proconfig, ',')
      INTO v_secdef, v_search
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'enforce_category_booking_status_transition';
    IF v_secdef IS NULL THEN
        RAISE EXCEPTION 'FAILED: enforce_category_booking_status_transition() missing after re-define.';
    END IF;
    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: enforce_category_booking_status_transition() is not SECURITY DEFINER.';
    END IF;
    IF v_search IS NULL OR v_search NOT LIKE '%search_path=%' THEN
        RAISE EXCEPTION 'FAILED: enforce_category_booking_status_transition() has no hardened search_path (got %).', v_search;
    END IF;

    RAISE NOTICE 'OK: category validator re-defined; photographer_id resolved generically.';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';

