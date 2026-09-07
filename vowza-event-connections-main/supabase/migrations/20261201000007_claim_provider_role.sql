-- ===========================================================================
-- 20261201000007  claim_provider_role()
--
-- PHASE A of three. This migration is ADDITIVE ONLY and safe to push on its
-- own, in any order relative to a Vercel deploy. It changes no policy, revokes
-- nothing from any client role, and breaks no existing call path.
--
--
-- WHAT THIS CLOSES
-- ----------------
-- 20261201000002 left a documented residual. Its INSERT policy is:
--
--     CREATE POLICY "user_roles_insert_unprivileged" ON public.user_roles
--         FOR INSERT TO authenticated
--         WITH CHECK (role IN ('customer','provider')
--             AND (user_id = auth.uid() OR has_role(...,'admin') OR has_role(...,'super_admin')));
--
-- The `user_id = auth.uid()` branch means ANY authenticated account can insert
-- its own `provider` row, with no provider_profiles row, no KYC documents, and
-- no admin involvement. One POST to /rest/v1/user_roles is enough.
--
-- The privilege that buys is currently modest -- provider_profiles has
-- owner-scoped policies, so a role with no profile is largely inert -- but it is
-- an unaudited self-grant of a role the app treats as a trust boundary, and it
-- is indistinguishable in the table from a role granted after real verification.
--
--
-- WHY A DEFINER FUNCTION RATHER THAN A NARROWER POLICY
-- ----------------------------------------------------
-- The correct invariant is "holding `provider` requires a provider_profiles row
-- for the same user". A policy cannot express that safely:
--
--   * A WITH CHECK subquery against provider_profiles is itself subject to that
--     table's RLS and needs the caller's column privileges on the columns it
--     reads. It would work today and silently invert the moment
--     provider_profiles' policies change -- exactly the failure mode that made
--     the 11 inert-RLS tables dangerous.
--   * A policy cannot write an audit row. Self-service role acquisition is the
--     one role transition with no human in the loop, so it is the one that most
--     needs a trail.
--
-- A SECURITY DEFINER function checks the precondition as the owner, writes the
-- audit row in the same transaction as the mutation, and gives the frontend a
-- single call it either succeeds at or does not.
--
--
-- DELIBERATELY NOT GATED ON verification_status
-- ---------------------------------------------
-- A vendor gets `provider` at submission time, while their profile is still
-- 'pending', because the provider dashboard is where they see that pending
-- state. Requiring 'approved' here would lock every new vendor out of the only
-- screen that tells them what is happening, and would be a behaviour regression
-- rather than a hardening. Approval is enforced by
-- provider_profiles.verification_status on the public listing path, not by role.
--
--
-- SEQUENCE -- read this before pushing anything else
-- --------------------------------------------------
-- Phase A (this file)  : add the function. Old and new frontend both keep working.
-- Phase B              : deploy the frontend that calls it (Vercel).
-- Phase C              : narrow the INSERT policy to `customer`-only self-grants.
--                        Held in supabase/migrations-pending/ so that a
--                        `supabase db push` CANNOT apply it early -- applying C
--                        before B is live breaks vendor registration.
--
-- This is the same ordering hazard as 20261201000006, resolved the opposite way:
-- there the frontend had to ship first because the migration removed a
-- privilege; here the migration ships first because it only adds one.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Preconditions
--
-- This matters more than it looks. plpgsql validates a function body's SYNTAX at
-- CREATE time but does not resolve table or column references, so a missing
-- `granted_by` column or a missing audit table would let this migration succeed
-- and then fail at the first real vendor registration -- a production landmine
-- rather than a failed deploy. Version ordering means a `supabase db push`
-- applies 000002 and 000003 first, but this file must not depend on being run
-- only ever in that way.
--
-- pg_catalog rather than information_schema: information_schema hides objects
-- the current role lacks privileges on, so it reports absence for things that
-- exist. to_regclass returns NULL instead of raising for a missing relation,
-- which is why it is used before any ::regclass cast.
-- ---------------------------------------------------------------------------
DO $pre$
BEGIN
    IF to_regclass('public.user_roles') IS NULL THEN
        RAISE EXCEPTION 'FAILED: public.user_roles does not exist.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_attribute
         WHERE attrelid = 'public.user_roles'::regclass
           AND attname  = 'granted_by'
           AND attnum > 0
           AND NOT attisdropped
    ) THEN
        RAISE EXCEPTION 'FAILED: public.user_roles.granted_by is missing. Apply 20261201000002 first.';
    END IF;

    IF to_regclass('public.provider_profiles') IS NULL THEN
        RAISE EXCEPTION 'FAILED: public.provider_profiles does not exist; the precondition this function enforces would be unverifiable.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_attribute
         WHERE attrelid = 'public.provider_profiles'::regclass
           AND attname  = 'user_id'
           AND attnum > 0
           AND NOT attisdropped
    ) THEN
        RAISE EXCEPTION 'FAILED: public.provider_profiles.user_id is missing.';
    END IF;

    -- The audit sink. Every branch of the function writes to it, including the
    -- denial branches, so if it is absent the function fails closed on every
    -- call -- which would block vendor registration entirely.
    IF to_regclass('vowza_audit.privileged_actions') IS NULL THEN
        RAISE EXCEPTION 'FAILED: vowza_audit.privileged_actions is missing. Apply 20261201000003 first.';
    END IF;

    -- 'noop' is written when the role was already held. If the CHECK constraint
    -- does not accept it, every repeat call raises 23514 instead of returning
    -- cleanly, and a vendor who resubmits gets an error.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'vowza_audit.privileged_actions'::regclass
           AND conname  = 'privileged_actions_outcome_check'
           AND pg_get_constraintdef(oid) LIKE '%noop%'
    ) THEN
        RAISE EXCEPTION 'FAILED: privileged_actions_outcome_check does not accept the ''noop'' outcome this function writes.';
    END IF;

    -- ON CONFLICT (user_id, role) infers a unique constraint over exactly that
    -- column set; with none, it raises 42P10 -- again at call time, not now.
    -- Compared as a sorted set because inference is order-insensitive, so a
    -- constraint declared (role, user_id) is equally valid. Same check as
    -- 20261201000004; kept here because this file must stand on its own.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
         WHERE c.conrelid = 'public.user_roles'::regclass
           AND c.contype IN ('u','p')
           AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
                  FROM pg_attribute a
                 WHERE a.attrelid = c.conrelid
                   AND a.attnum = ANY (c.conkey))
               = ARRAY['role','user_id']
    ) THEN
        RAISE EXCEPTION 'FAILED: no UNIQUE (user_id, role) on public.user_roles, so ON CONFLICT would error at call time.';
    END IF;

    -- The function reads auth.users to record actor_email in the audit row, and
    -- a SECURITY DEFINER function runs as its owner -- which CREATE FUNCTION
    -- sets to current_user, the role applying this migration. So the privilege
    -- that matters is this role's, and it is proved rather than assumed.
    IF NOT has_schema_privilege(current_user, 'auth', 'USAGE')
       OR NOT has_table_privilege(current_user, 'auth.users', 'SELECT') THEN
        RAISE EXCEPTION
          'FAILED: role % cannot read auth.users, which claim_provider_role() reads for the audit email. Grant USAGE ON SCHEMA auth and SELECT ON auth.users to %, or apply this migration as a role that has them.',
          current_user, current_user;
    END IF;

    PERFORM 1 FROM auth.users LIMIT 1;   -- exercises it, not just the catalog
END;
$pre$;

-- ---------------------------------------------------------------------------
-- 1. The function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_provider_role()
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $fn$
DECLARE
    v_uid         uuid := auth.uid();
    v_email       text;
    v_has_profile boolean;
    v_rows        integer;
BEGIN
    -- No verified session. auth.uid() is derived from the JWT, never from a
    -- client-supplied argument -- which is why this function takes no
    -- parameters at all. There is deliberately no "grant to user X" form.
    IF v_uid IS NULL THEN
        INSERT INTO vowza_audit.privileged_actions
            (action, outcome, subject_role, detail, source)
        VALUES ('claim_provider_role', 'denied', 'provider'::public.app_role,
                jsonb_build_object('reason', 'NO_SESSION'), 'rpc');
        RETURN jsonb_build_object('ok', false, 'code', 'NO_SESSION');
    END IF;

    SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;

    SELECT EXISTS (
        SELECT 1 FROM public.provider_profiles pp WHERE pp.user_id = v_uid
    ) INTO v_has_profile;

    -- The whole point of the function: no profile, no role.
    IF NOT v_has_profile THEN
        INSERT INTO vowza_audit.privileged_actions
            (actor_id, actor_email, action, outcome,
             target_user_id, target_email, subject_role, detail, source)
        VALUES (v_uid, v_email, 'claim_provider_role', 'denied',
                v_uid, v_email, 'provider'::public.app_role,
                jsonb_build_object('reason', 'NO_PROVIDER_PROFILE'), 'rpc');
        RETURN jsonb_build_object('ok', false, 'code', 'NO_PROVIDER_PROFILE');
    END IF;

    -- DO NOTHING, not DO UPDATE: there is no payload on this row to update, and
    -- DO UPDATE would require the UPDATE privilege -- which 20261201000002
    -- withholds precisely because UPDATE on user_roles is the escalation
    -- primitive. The function owner bypasses RLS (no FORCE ROW LEVEL SECURITY
    -- on this table, by design), so this insert is unaffected by Phase C.
    --
    -- The conflict target is named explicitly, matching admin_set_user_role in
    -- 20261201000004. A bare ON CONFLICT DO NOTHING swallows a violation of ANY
    -- unique or exclusion constraint on the table, so if user_roles later gains
    -- one, a genuine failure would be silently reported to the vendor as "you
    -- already have this role". Naming (user_id, role) means only the intended
    -- collision is tolerated; it resolves against user_roles_user_id_role_key.
    INSERT INTO public.user_roles (user_id, role, granted_by)
    VALUES (v_uid, 'provider'::public.app_role, v_uid)
    ON CONFLICT (user_id, role) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    INSERT INTO vowza_audit.privileged_actions
        (actor_id, actor_email, action, outcome,
         target_user_id, target_email, subject_role, detail, source)
    VALUES (v_uid, v_email, 'claim_provider_role',
            CASE WHEN v_rows > 0 THEN 'applied' ELSE 'noop' END,
            v_uid, v_email, 'provider'::public.app_role,
            jsonb_build_object('already_held', v_rows = 0), 'rpc');

    RETURN jsonb_build_object('ok', true, 'changed', v_rows > 0);
END;
$fn$;

COMMENT ON FUNCTION public.claim_provider_role() IS
    'Self-service acquisition of the provider role, allowed only for a caller who already has a provider_profiles row. Takes no arguments: the subject is always auth.uid(), so it cannot be aimed at another account. Writes vowza_audit.privileged_actions on every outcome including denials.';

-- ---------------------------------------------------------------------------
-- 2. Grants
--
-- EXECUTE arrives via PUBLIC by default, so PUBLIC is what has to be named --
-- revoking only from `anon` would leave the function callable by anon through
-- its PUBLIC membership.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.claim_provider_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_provider_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_provider_role() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Assertions -- catalog facts, executed, not inspected by eye
-- ---------------------------------------------------------------------------
DO $assert$
DECLARE
    v_oid       oid;
    v_secdef    boolean;
    v_config    text[];
    v_anon      boolean;
    v_auth      boolean;
    v_public    boolean;
BEGIN
    SELECT p.oid, p.prosecdef, p.proconfig
      INTO v_oid, v_secdef, v_config
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'claim_provider_role'
       AND p.pronargs = 0;

    IF v_oid IS NULL THEN
        RAISE EXCEPTION 'FAILED: public.claim_provider_role() was not created.';
    END IF;

    IF NOT v_secdef THEN
        RAISE EXCEPTION 'FAILED: claim_provider_role() is not SECURITY DEFINER; it would run as the caller and the provider_profiles precondition would be subject to that table''s RLS.';
    END IF;

    -- An unpinned search_path in a definer function is a hijack vector: the
    -- caller sets search_path, so an attacker-owned schema earlier in the path
    -- could shadow provider_profiles or user_roles.
    IF v_config IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(v_config) c WHERE c LIKE 'search_path=%'
    ) THEN
        RAISE EXCEPTION 'FAILED: claim_provider_role() has no pinned search_path.';
    END IF;

    v_anon   := has_function_privilege('anon',          v_oid, 'EXECUTE');
    v_auth   := has_function_privilege('authenticated', v_oid, 'EXECUTE');

    -- A NULL proacl is not "no privileges" -- it means default privileges, and
    -- the default for a function is EXECUTE TO PUBLIC. So NULL must be treated
    -- as "PUBLIC holds EXECUTE", which is the opposite of how it reads.
    SELECT CASE
               WHEN p.proacl IS NULL THEN true
               ELSE EXISTS (
                   SELECT 1 FROM aclexplode(p.proacl) a
                    WHERE a.grantee = 0            -- 0 is PUBLIC
                      AND a.privilege_type = 'EXECUTE'
               )
           END
      INTO v_public
      FROM pg_proc p
     WHERE p.oid = v_oid;

    IF v_public THEN
        RAISE EXCEPTION 'FAILED: PUBLIC still holds EXECUTE on claim_provider_role(); anon inherits it through PUBLIC membership.';
    END IF;

    IF v_anon THEN
        RAISE EXCEPTION 'FAILED: anon can still EXECUTE claim_provider_role().';
    END IF;

    IF NOT v_auth THEN
        RAISE EXCEPTION 'FAILED: authenticated lost EXECUTE on claim_provider_role(); vendor registration and artist onboarding both call it.';
    END IF;

    RAISE NOTICE 'claim_provider_role(): SECURITY DEFINER, search_path pinned, anon=%, authenticated=%', v_anon, v_auth;
END;
$assert$;

COMMIT;

-- PostgREST caches the schema; a new RPC is invisible until it reloads.
NOTIFY pgrst, 'reload schema';
