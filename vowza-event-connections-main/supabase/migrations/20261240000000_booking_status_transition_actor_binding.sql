-- 20261240000000_booking_status_transition_actor_binding.sql
--
-- P0 Phase C (booking state machine) — ACTOR BINDING. The DAG guards
-- (20261237000000 / 20261238000000 / 20261239000000) enforce which status
-- VALUE transitions are legal and that terminal states are final, but NOT WHO
-- may perform each edge. RLS still lets the owning CUSTOMER PATCH their own
-- booking requested/pending -> accepted (self-approving on the vendor's
-- behalf) or in_progress -> completed (self-completing), because those edges
-- are DAG-legal and the customer_update RLS policy has no value check.
--
-- This migration upgrades BOTH validator functions in place (CREATE OR REPLACE;
-- the existing triggers pick up the new bodies) to consult a shared actor
-- helper AFTER the legal-DAG check:
--
--   -> accepted     : PROVIDER only   (blocks customer self-approval)   [KEY FIX]
--   -> rejected     : PROVIDER only   (customers cancel, never reject)
--   -> completed    : PROVIDER only   (blocks customer self-completion) [KEY FIX]
--   -> in_progress  : customer OR provider (pay-advance is the customer)
--   -> cancelled    : customer OR provider (either party may cancel)
--
-- BYPASS (unchanged, applied BEFORE both the DAG and actor checks): a no-op
-- status write always passes; auth.uid() IS NULL (service_role / trusted server
-- contexts such as the service-start OTP RPC) and admins/super_admins bypass the
-- whole machine. The per-category accept RPCs keep working because they run with
-- the calling PROVIDER's JWT (SECURITY DEFINER does not change auth.uid()), so
-- is_provider is true inside them.
--
-- CLASSIFICATION: SECURITY FIX (binds each legal edge to its authorized actor) +
--   BEHAVIOR PRESERVATION for every traced legitimate path (provider accept via
--   RPC / raw, customer pay-advance -> in_progress, provider completeService,
--   customer/vendor cancel, service-start OTP as service_role). ADDITIVE — adds
--   one helper and re-defines two existing functions; revokes nothing.
--
-- NOT RUNTIME-VERIFIABLE here (no live DB): the legal/actor logic is proven
--   statically + by the migration's own $catalog$/$verify$ at APPLY time; the
--   actor mapping was derived from a full trace of every status writer.
--
-- ROLLBACK: re-apply 20261237000000 / 20261238000000 bodies (DAG-only), then
--   DROP FUNCTION public.booking_transition_actor_allowed(uuid,uuid,text,text);
BEGIN;

SET search_path = public, pg_temp;
-- ===========================================================================
-- FAIL-CLOSED DRIFT GUARD: the two DAG validators must already exist (this
-- migration re-defines them), and provider ownership must be resolvable via
-- provider_profiles(id, user_id).
-- ===========================================================================
DO $catalog$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'enforce_bookings_status_transition'
    ) THEN
        RAISE EXCEPTION 'ABORT actor binding: enforce_bookings_status_transition() missing (apply 20261237000000 first).';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'enforce_category_booking_status_transition'
    ) THEN
        RAISE EXCEPTION 'ABORT actor binding: enforce_category_booking_status_transition() missing (apply 20261238000000 first).';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_attribute a
         WHERE a.attrelid = 'public.provider_profiles'::regclass
           AND a.attname = 'user_id' AND a.attnum > 0 AND NOT a.attisdropped
    ) THEN
        RAISE EXCEPTION 'ABORT actor binding: provider_profiles.user_id not found.';
    END IF;

    RAISE NOTICE 'OK: actor-binding preconditions satisfied.';
END $catalog$;
-- ===========================================================================
-- Shared actor helper. Called only for a NON-admin, NON-service caller on an
-- already-legal edge (the trigger applies the no-op/service/admin bypass and the
-- DAG check first). Returns whether v_uid may drive p_from -> p_to.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.booking_transition_actor_allowed(
    p_customer_id uuid,
    p_provider_id uuid,
    p_from        text,
    p_to          text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_uid       uuid := auth.uid();
    is_customer boolean := (v_uid IS NOT NULL AND v_uid = p_customer_id);
    is_provider boolean;
BEGIN
    is_provider := EXISTS (
        SELECT 1 FROM public.provider_profiles pp
         WHERE pp.id = p_provider_id AND pp.user_id = v_uid
    );
    IF p_to = 'accepted' THEN
        RETURN is_provider;                    -- only the provider accepts
    ELSIF p_to = 'rejected' THEN
        RETURN is_provider;                    -- only the provider declines
    ELSIF p_to = 'completed' THEN
        RETURN is_provider;                    -- only the provider completes work
    ELSIF p_to = 'in_progress' THEN
        RETURN is_customer OR is_provider;     -- customer pay-advance (or provider)
    ELSIF p_to = 'cancelled' THEN
        RETURN is_customer OR is_provider;     -- either party may cancel
    END IF;
    RETURN false;
END $fn$;
-- ===========================================================================
-- Re-define the GENERIC bookings validator (enum status, 'requested') to add
-- the actor check after the legal-DAG check. Bypass + DAG unchanged.
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
    IF v_new IS NOT DISTINCT FROM v_old THEN
        RETURN NEW;
    END IF;

    -- Full bypass: service_role / trusted server contexts (no JWT) and admins.
    IF auth.uid() IS NULL
       OR public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
        RETURN NEW;
    END IF;

    -- Legal transition DAG (terminals have no outgoing edge).
    IF NOT (
        (v_old = 'requested'   AND v_new IN ('accepted', 'rejected', 'cancelled'))
     OR (v_old = 'accepted'    AND v_new IN ('in_progress', 'cancelled', 'rejected'))
     OR (v_old = 'in_progress' AND v_new IN ('completed', 'cancelled'))
    ) THEN
        RAISE EXCEPTION
            'Illegal booking status transition: % -> % (booking %)', v_old, v_new, OLD.id
            USING ERRCODE = '23514';
    END IF;

    -- Actor binding: the legal edge must be performed by its authorized party.
    IF NOT public.booking_transition_actor_allowed(
            OLD.customer_id, OLD.provider_id, v_old::text, v_new::text) THEN
        RAISE EXCEPTION
            'Not authorized to change booking status % -> % (booking %)', v_old, v_new, OLD.id
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END $fn$;
-- ===========================================================================
-- Re-define the shared CATEGORY validator (text status, 'pending') to add the
-- same actor check after the legal-DAG check.
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
            OLD.customer_id, OLD.provider_id, v_old, v_new) THEN
        RAISE EXCEPTION
            'Not authorized to change booking status % -> % (booking %)', v_old, v_new, OLD.id
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END $fn$;
-- ===========================================================================
-- FAIL-CLOSED SELF-CHECK. Both validators + the helper must be hardened.
-- ===========================================================================
DO $verify$
DECLARE
    v_rec record;
    v_helper_secdef boolean;
BEGIN
    FOR v_rec IN
        SELECT p.proname, p.prosecdef,
               array_to_string(p.proconfig, ',') AS cfg
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname IN ('enforce_bookings_status_transition',
                             'enforce_category_booking_status_transition',
                             'booking_transition_actor_allowed')
    LOOP
        IF NOT v_rec.prosecdef THEN
            RAISE EXCEPTION 'FAILED: %() is not SECURITY DEFINER.', v_rec.proname;
        END IF;
        IF v_rec.cfg IS NULL OR v_rec.cfg NOT LIKE '%search_path=%' THEN
            RAISE EXCEPTION 'FAILED: %() has no hardened search_path (got %).', v_rec.proname, v_rec.cfg;
        END IF;
    END LOOP;

    SELECT p.prosecdef INTO v_helper_secdef
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'booking_transition_actor_allowed';
    IF v_helper_secdef IS NULL THEN
        RAISE EXCEPTION 'FAILED: booking_transition_actor_allowed() was not created.';
    END IF;

    RAISE NOTICE 'OK: actor-bound status validators installed (both triggers + helper hardened).';
END $verify$;

COMMIT;

NOTIFY pgrst, 'reload schema';



