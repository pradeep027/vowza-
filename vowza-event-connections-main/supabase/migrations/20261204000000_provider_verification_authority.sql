-- 20261204000000_provider_verification_authority.sql
--
-- P0-2: prevent provider self-approval.
--
-- Requires: 20261201000003_audit_schema.sql (vowza_audit.privileged_actions),
--           public.has_role(uuid, public.app_role), public.provider_profiles.
--
-- ---------------------------------------------------------------------------
-- DEPLOY ORDER -- READ THIS FIRST
-- ---------------------------------------------------------------------------
-- This migration is ADDITIVE and safe to apply at any time, before or after
-- the frontend that calls it. It:
--   * adds two SECURITY DEFINER RPCs (admin_set_provider_verification,
--     provider_resubmit_for_review),
--   * adds a BEFORE INSERT trigger clamping the trust/approval/reputation
--     columns of every new provider_profiles row to a safe baseline,
--   * adds a BEFORE UPDATE trigger resetting is_bank_verified when a bank_*
--     column changes.
-- None of these removes a privilege the running frontend depends on, so the
-- live site keeps working unchanged after this lands.
--
-- The privilege REMOVAL that actually closes the direct-PATCH hole --
--   REVOKE UPDATE ON public.provider_profiles FROM authenticated, then
--   GRANT UPDATE (<benign columns>) back --
-- is a BREAKING change and lives in supabase/migrations-pending/
-- PHASE_provider_column_lockdown.sql. Apply it only AFTER the rewired frontend
-- (which routes admin approval and vendor resubmit through the two RPCs below,
-- and stops writing is_bank_verified from the client) is live in production
-- and verified. See that file's header.
--
-- ---------------------------------------------------------------------------
-- WHY NEW RPCs AND NOT A REUSE OF approve_artist / reject_artist
-- ---------------------------------------------------------------------------
-- public.approve_artist(uuid,uuid) and public.reject_artist(uuid,uuid,text)
-- already exist in production, but they are the impersonation-shaped design:
-- the actor is a PARAMETER (p_admin_user_id) with no has_role check, so they
-- are safe only because EXECUTE is granted to service_role alone. That is why
-- the admin panel cannot call them from the browser and PATCHes
-- provider_profiles directly today -- the hole this closes. Widening their
-- EXECUTE to authenticated would turn them into an impersonation primitive.
-- Instead this adds a function that derives the actor from auth.uid() and can
-- be granted to authenticated safely. The legacy pair is left untouched.
--
-- ROLLBACK: DROP FUNCTION public.admin_set_provider_verification(uuid,text,text);
--           DROP FUNCTION public.provider_resubmit_for_review(uuid);
--           DROP TRIGGER provider_profiles_clamp_trust_baseline ON public.provider_profiles;
--           DROP TRIGGER provider_profiles_bank_reverify ON public.provider_profiles;
--           DROP FUNCTION public.provider_profiles_clamp_trust_baseline();
--           DROP FUNCTION public.provider_profiles_bank_reverify();
--           NOTIFY pgrst, 'reload schema';

BEGIN;

SET search_path = public, pg_temp;

-- ===========================================================================
-- admin_set_provider_verification -- the ONLY authorized writer of the
-- approval columns for an admin acting from a browser session.
--
-- Actor is auth.uid(), never a parameter: this cannot be aimed at another
-- account, and cannot become an impersonation primitive if its EXECUTE grant
-- is ever widened by accident. Authorization is admin OR super_admin; anything
-- else is audited 'denied' and RETURNS {success:false} without RAISE, so the
-- audit row survives the transaction (a RAISE would roll it back).
--
-- verified_by is set to auth.uid(), never to a client-supplied id. Role
-- grant/revoke and the applicant notification stay in the caller
-- (src/services/approvalService.ts via src/lib/userRoles.ts), which already
-- routes them through the hardened user_roles path; doing them here would
-- double-write.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.admin_set_provider_verification(
    p_provider_id uuid,
    p_action      text,
    p_reason      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_uid        uuid := auth.uid();
    v_email      text;
    v_target_uid uuid;
    v_now        timestamptz := now();
    v_rows       int;
BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

    -- Authorization: admin or super_admin only.
    IF v_uid IS NULL
       OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
        INSERT INTO vowza_audit.privileged_actions
            (actor_id, actor_email, action, outcome, detail, source)
        VALUES (v_uid, v_email, 'admin_set_provider_verification', 'denied',
                jsonb_build_object('provider_id', p_provider_id,
                                   'requested_action', p_action), 'rpc');
        RETURN jsonb_build_object('success', false, 'code', 'not_authorized',
            'message', 'Admin privileges are required to change verification status.');
    END IF;

    -- Resolve the target so the audit row keys on a real account.
    SELECT user_id INTO v_target_uid FROM public.provider_profiles WHERE id = p_provider_id;
    IF v_target_uid IS NULL THEN
        INSERT INTO vowza_audit.privileged_actions
            (actor_id, actor_email, action, outcome, detail, source)
        VALUES (v_uid, v_email, 'admin_set_provider_verification', 'failed',
                jsonb_build_object('provider_id', p_provider_id,
                                   'reason', 'provider_not_found'), 'rpc');
        RETURN jsonb_build_object('success', false, 'code', 'not_found',
            'message', 'Provider not found.');
    END IF;

    IF p_action = 'approve' THEN
        UPDATE public.provider_profiles SET
            verification_status = 'approved',
            is_published        = true,
            is_verified         = true,
            verified_at         = v_now,
            verified_by         = v_uid,
            rejection_reason    = null
        WHERE id = p_provider_id;

    ELSIF p_action = 'reject' THEN
        IF p_reason IS NULL OR btrim(p_reason) = '' THEN
            RETURN jsonb_build_object('success', false, 'code', 'reason_required',
                'message', 'A rejection reason is required.');
        END IF;
        UPDATE public.provider_profiles SET
            verification_status = 'rejected',
            is_published        = false,
            is_verified         = false,
            rejection_reason    = btrim(p_reason),
            verified_at         = v_now,
            verified_by         = v_uid
        WHERE id = p_provider_id;

    ELSIF p_action = 'suspend' THEN
        UPDATE public.provider_profiles SET
            verification_status = 'suspended',
            is_published        = false,
            rejection_reason    = p_reason
        WHERE id = p_provider_id;

    ELSE
        RETURN jsonb_build_object('success', false, 'code', 'invalid_action',
            'message', format('Unknown action %L.', p_action));
    END IF;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    INSERT INTO vowza_audit.privileged_actions
        (actor_id, actor_email, action, outcome, target_user_id, subject_role, detail, source)
    VALUES (v_uid, v_email, 'admin_set_provider_verification',
            CASE WHEN v_rows > 0 THEN 'applied' ELSE 'noop' END,
            v_target_uid, 'provider'::public.app_role,
            jsonb_build_object('provider_id', p_provider_id, 'action', p_action), 'rpc');

    RETURN jsonb_build_object('success', true, 'action', p_action,
        'provider_id', p_provider_id,
        'verification_status', CASE p_action WHEN 'approve' THEN 'approved'
                                             WHEN 'reject'  THEN 'rejected'
                                             ELSE 'suspended' END);
END;
$fn$;

-- ===========================================================================
-- provider_resubmit_for_review -- the constrained owner path.
--
-- The vendor edit page lets a REJECTED provider resubmit, flipping
-- verification_status back to 'pending' and clearing rejection_reason. Once the
-- column lockdown lands the owner can no longer PATCH verification_status
-- directly, so this narrow definer function replaces it. It permits exactly one
-- transition -- the caller's OWN row, and only rejected -> pending -- and can
-- neither approve, publish, nor verify.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.provider_resubmit_for_review(
    p_provider_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_uid    uuid := auth.uid();
    v_owner  uuid;
    v_status text;
    v_rows   int;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'no_session',
            'message', 'Your session has expired. Please sign in again.');
    END IF;

    SELECT user_id, verification_status INTO v_owner, v_status
      FROM public.provider_profiles WHERE id = p_provider_id;

    IF v_owner IS NULL OR v_owner <> v_uid THEN
        INSERT INTO vowza_audit.privileged_actions
            (actor_id, action, outcome, detail, source)
        VALUES (v_uid, 'provider_resubmit_for_review', 'denied',
                jsonb_build_object('provider_id', p_provider_id, 'reason', 'not_owner'), 'rpc');
        RETURN jsonb_build_object('success', false, 'code', 'not_owner',
            'message', 'You can only resubmit your own profile.');
    END IF;

    IF v_status IS DISTINCT FROM 'rejected' THEN
        RETURN jsonb_build_object('success', false, 'code', 'not_rejected',
            'message', 'Only a rejected profile can be resubmitted for review.');
    END IF;

    UPDATE public.provider_profiles SET
        verification_status = 'pending',
        rejection_reason    = null
    WHERE id = p_provider_id AND user_id = v_uid AND verification_status = 'rejected';

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    INSERT INTO vowza_audit.privileged_actions
        (actor_id, action, outcome, target_user_id, subject_role, detail, source)
    VALUES (v_uid, 'provider_resubmit_for_review',
            CASE WHEN v_rows > 0 THEN 'applied' ELSE 'noop' END,
            v_uid, 'provider'::public.app_role,
            jsonb_build_object('provider_id', p_provider_id), 'rpc');

    RETURN jsonb_build_object('success', v_rows > 0, 'verification_status', 'pending');
END;
$fn$;

-- ===========================================================================
-- Clamp the trust/approval/reputation columns of every NEW row to a safe
-- baseline. authenticated still holds INSERT on these columns (the lockdown
-- only revokes UPDATE), so without this a self-registering vendor could POST
-- is_verified=true / verification_status='approved' and appear in the listings
-- unreviewed. The DB column defaults already equal these values; this makes the
-- guarantee independent of both the defaults and the client payload.
--
-- Every legitimate insert path (ProviderRegistration, ArtistOnboarding) sets
-- either 'pending' or nothing for these columns, so this changes no legitimate
-- behaviour. Approval is always a later UPDATE via
-- admin_set_provider_verification.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.provider_profiles_clamp_trust_baseline()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
    AS $fn$
BEGIN
    NEW.verification_status := 'pending';
    NEW.is_verified         := false;
    NEW.is_published        := false;
    NEW.is_featured         := false;
    NEW.featured_until      := null;
    NEW.verified_at         := null;
    NEW.verified_by         := null;
    NEW.is_bank_verified    := false;
    NEW.average_rating      := 0;
    NEW.total_reviews       := 0;
    NEW.total_bookings      := 0;
    RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS provider_profiles_clamp_trust_baseline ON public.provider_profiles;
CREATE TRIGGER provider_profiles_clamp_trust_baseline
    BEFORE INSERT ON public.provider_profiles
    FOR EACH ROW EXECUTE FUNCTION public.provider_profiles_clamp_trust_baseline();

-- ===========================================================================
-- Reset is_bank_verified whenever a bank_* column changes. saveBankDetails
-- (src/hooks/useVendorData.ts) sets is_bank_verified=false in its payload
-- today; the column lockdown will strip its UPDATE privilege on that column, so
-- this trigger keeps the "editing bank details forces re-verification"
-- invariant once the client stops writing it. A BEFORE trigger's assignment to
-- NEW is not subject to column-level UPDATE privileges, so it still works for
-- the owner after is_bank_verified is withheld from authenticated.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.provider_profiles_bank_reverify()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
    AS $fn$
BEGIN
    IF NEW.bank_name            IS DISTINCT FROM OLD.bank_name
       OR NEW.bank_account_holder IS DISTINCT FROM OLD.bank_account_holder
       OR NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number
       OR NEW.bank_ifsc           IS DISTINCT FROM OLD.bank_ifsc
       OR NEW.branch_name         IS DISTINCT FROM OLD.branch_name THEN
        NEW.is_bank_verified := false;
    END IF;
    RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS provider_profiles_bank_reverify ON public.provider_profiles;
CREATE TRIGGER provider_profiles_bank_reverify
    BEFORE UPDATE ON public.provider_profiles
    FOR EACH ROW EXECUTE FUNCTION public.provider_profiles_bank_reverify();

-- Client roles reach the admin function only through the has_role gate inside
-- it; authenticated needs EXECUTE (the gate does the real work), anon/PUBLIC
-- get nothing. The owner function is likewise authenticated-only.
REVOKE ALL ON FUNCTION public.admin_set_provider_verification(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_set_provider_verification(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.provider_resubmit_for_review(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.provider_resubmit_for_review(uuid) TO authenticated;

-- ===========================================================================
-- Verification. A failed assertion aborts the whole transaction.
-- ===========================================================================
DO $$
DECLARE
    n        int;
    v_missing text;
BEGIN
    -- The definer must read auth.users for the audit email.
    IF NOT has_table_privilege(current_user, 'auth.users', 'SELECT') THEN
        RAISE EXCEPTION 'FAILED: % cannot SELECT auth.users, which the audit path reads.', current_user;
    END IF;

    -- Exactly one signature each, so PostgREST cannot hit an ambiguous overload.
    SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname='public' AND p.proname='admin_set_provider_verification';
    IF n <> 1 THEN RAISE EXCEPTION 'FAILED: % overloads of admin_set_provider_verification (expected 1).', n; END IF;

    SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname='public' AND p.proname='provider_resubmit_for_review';
    IF n <> 1 THEN RAISE EXCEPTION 'FAILED: % overloads of provider_resubmit_for_review (expected 1).', n; END IF;

    -- Both must be SECURITY DEFINER with a pinned search_path.
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
                WHERE ns.nspname='public'
                  AND p.proname IN ('admin_set_provider_verification','provider_resubmit_for_review')
                  AND (NOT p.prosecdef
                       OR NOT ('search_path=public, pg_temp' = ANY(p.proconfig)))) THEN
        RAISE EXCEPTION 'FAILED: a P0-2 function is not SECURITY DEFINER with search_path=public, pg_temp.';
    END IF;

    -- anon must not reach either function; authenticated must reach both (the
    -- has_role/owner gate inside is the control, not the grant).
    IF has_function_privilege('anon','public.admin_set_provider_verification(uuid,text,text)','EXECUTE')
       OR has_function_privilege('anon','public.provider_resubmit_for_review(uuid)','EXECUTE') THEN
        RAISE EXCEPTION 'FAILED: anon can execute a P0-2 verification function.';
    END IF;
    IF NOT has_function_privilege('authenticated','public.admin_set_provider_verification(uuid,text,text)','EXECUTE')
       OR NOT has_function_privilege('authenticated','public.provider_resubmit_for_review(uuid)','EXECUTE') THEN
        RAISE EXCEPTION 'FAILED: authenticated cannot execute a P0-2 verification function.';
    END IF;

    -- The clamp/bank triggers reference these columns by name; a rename would
    -- otherwise surface as a runtime error on the next registration, not here.
    SELECT string_agg(req.col, ', ') INTO v_missing
      FROM (VALUES
        ('verification_status'),('is_verified'),('is_published'),('is_featured'),
        ('featured_until'),('verified_at'),('verified_by'),('is_bank_verified'),
        ('average_rating'),('total_reviews'),('total_bookings'),
        ('bank_name'),('bank_account_holder'),('bank_account_number'),
        ('bank_ifsc'),('branch_name')) AS req(col)
     WHERE NOT EXISTS (
        SELECT 1 FROM pg_attribute a
         WHERE a.attrelid='public.provider_profiles'::regclass
           AND a.attname=req.col AND NOT a.attisdropped);
    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'FAILED: provider_profiles is missing columns referenced by the P0-2 triggers: %', v_missing;
    END IF;

    -- Both triggers must exist.
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
                    WHERE tgname='provider_profiles_clamp_trust_baseline'
                      AND tgrelid='public.provider_profiles'::regclass AND NOT tgisinternal) THEN
        RAISE EXCEPTION 'FAILED: provider_profiles_clamp_trust_baseline trigger missing.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
                    WHERE tgname='provider_profiles_bank_reverify'
                      AND tgrelid='public.provider_profiles'::regclass AND NOT tgisinternal) THEN
        RAISE EXCEPTION 'FAILED: provider_profiles_bank_reverify trigger missing.';
    END IF;

    RAISE NOTICE 'OK: P0-2 verification RPCs and trust triggers installed.';
END $$;

COMMIT;

-- PostgREST caches the exposed schema; without this /rpc/admin_set_provider_verification
-- and /rpc/provider_resubmit_for_review return PGRST202 until the next DDL event.
NOTIFY pgrst, 'reload schema';
