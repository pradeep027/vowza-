-- 20261201000004_admin_role_mutation.sql
--
-- Server-side replacement for the browser-side role grant/revoke in
-- src/pages/admin/AdminAdmins.tsx:52-72, which 20261201000002 disabled.
--
-- Requires: 20261201000003_audit_schema.sql
--
-- ---------------------------------------------------------------------------
-- THE SHAPE OF THIS FUNCTION IS THE WHOLE SECURITY ARGUMENT. READ THIS FIRST.
-- ---------------------------------------------------------------------------
-- admin_set_user_role takes the actor's id as a PARAMETER and acts on the
-- authority of it. That is the same shape as make_admin(uuid) -- the function
-- that produced the original P0 -- and it is only safe because EXECUTE is
-- granted to service_role ALONE and revoked from PUBLIC. service_role's key
-- never reaches a browser; it exists only in Edge Function environment
-- variables. The Edge Function establishes the actor by verifying the caller's
-- JWT through auth.getUser() before calling this.
--
-- If EXECUTE on this function ever leaks to anon or authenticated, it becomes
-- an impersonation primitive: pass any super_admin's uuid and inherit their
-- authority. The verification block at the bottom asserts that has not
-- happened, and the eventual EXECUTE sweep must never widen it.
--
-- Contrast the two reader functions below, which derive the actor from
-- auth.uid() and therefore cannot be impersonated at all. That is the safe
-- shape; use it wherever the call can come from a user session.
--
-- ---------------------------------------------------------------------------
-- DECISIONS TAKEN HERE, AND WHY
-- ---------------------------------------------------------------------------
-- 1. Authorization requires super_admin, not admin. AdminAdmins.tsx:16
--    already refuses to render for anyone but a super_admin, so this makes the
--    server agree with the UI's own intent. Allowing admins to mint admins
--    also flattens the two tiers into one: any admin could manufacture peers
--    faster than they could be removed.
--
-- 2. The only role this endpoint can change is 'admin'.
--
--    super_admin is excluded because there is one of them: an endpoint that can
--    create a second, or remove the only one, is an escalation and a lockout in
--    one call. Changing it is a deliberate SQL-editor act.
--
--    provider and customer are excluded for a different reason. A provider's
--    role is not standalone -- it exists alongside a provider_profiles row and
--    a verification state, and make_provider / approve_artist / reject_artist
--    already move those together. A generic "revoke provider" here would strip
--    the role while leaving an approved, verified provider_profile behind, and
--    the vendor would find their account half-working with nothing in the
--    listings to explain why. Role changes that have dependent rows belong in
--    the flow that owns those rows.
--
--    So this primitive stays as narrow as the UI that needs it.
--
-- 3. Grants resolve the target through auth.users.email; revokes take a
--    user_id and never an email. This asymmetry is the point.
--
--    profiles.email is written by the row owner (workerOnboarding.ts:171).
--    Resolving a GRANT there would let a user claim an address an admin is
--    about to invite and receive the grant meant for someone else -- so grants
--    resolve against auth.users.email, which only GoTrue writes.
--
--    Revokes are worse if handled by email, and less obviously so. The admin
--    list renders profiles.email, so a user who sets their profile email to a
--    real admin's address makes the "remove" button next to *their* row
--    resolve to the *real* admin, and a super_admin clicking it would revoke
--    the wrong person while believing they had removed the attacker. Revokes
--    therefore key on user_roles.user_id, which no client can write.
--
--    p_target_id wins whenever both are supplied.
--
-- 4. Every outcome is audited, including denials and failures. PR #13's
--    verification function returns 403 before writing anything, so refused
--    attempts leave no trace -- exactly the events worth keeping. This
--    function RETURNS a failure payload instead of raising, so the audit row
--    commits, and it catches unexpected errors to record them too.
--
-- 5. An actor cannot change their own roles. Prevents both self-escalation
--    and the sole super_admin demoting themselves into a locked-out project.
--
-- 6. FORBIDDEN denials are rate-limited to one row per actor per 5 minutes.
--    Any authenticated user can reach the Edge Function, and auditing every
--    rejection would let one of them inflate the audit table without limit.
--    Refusing to log denials (PR #13's behaviour) is the wrong fix -- it
--    discards the events most worth keeping. Keeping the first denial in each
--    window preserves the signal, since the tenth identical rejection from the
--    same actor tells you nothing the first did not. Only FORBIDDEN is
--    throttled; every other outcome is reachable only by a super_admin.
--
-- 7. admin_list_admins replaces the three client queries the page used to run.
--    Besides returning an auth-derived email instead of a self-declared one,
--    it means the page stops reading public.user_roles from the browser
--    altogether -- which is one of the call sites standing between us and
--    revoking anon's SELECT on that table.
--
-- ---------------------------------------------------------------------------
-- IF THIS MIGRATION HAS ALREADY BEEN APPLIED, DO NOT EDIT IT.
-- Adding or removing a parameter creates an OVERLOAD rather than replacing the
-- function, and PostgREST would then fail to resolve the call. Corrections go
-- in a new version that DROPs the old signature explicitly.
-- ---------------------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
        p_actor_id     uuid,
        p_action       text,
        p_role         public.app_role,
        p_target_id    uuid DEFAULT NULL,
        p_target_email text DEFAULT NULL
    ) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
    v_actor_email  text;
    v_target_id    uuid;
    v_target_email text;
    v_is_super     boolean;
    v_changed      boolean := false;
    v_suppress     boolean := false;
    v_matches      integer;
    v_outcome      text;
    v_code         text;
    v_message      text;
BEGIN
    p_target_email := lower(trim(coalesce(p_target_email, '')));

    SELECT u.email::text INTO v_actor_email FROM auth.users u WHERE u.id = p_actor_id;

    -- -------------------------------------------------------------------
    -- Guards. Each records a 'denied' row and returns; none raises, so the
    -- audit row survives the transaction.
    -- -------------------------------------------------------------------
    IF p_action IS NULL OR p_action NOT IN ('grant','revoke') THEN
        v_code := 'INVALID_ACTION';
        v_message := 'Action must be grant or revoke.';
    ELSIF p_role IS DISTINCT FROM 'admin'::public.app_role THEN
        -- 'admin' only. See decision 2.
        v_code := 'ROLE_NOT_MANAGEABLE';
        v_message := 'Only the admin role can be changed from the admin panel.';
    ELSIF p_actor_id IS NULL
          OR NOT public.has_role(p_actor_id, 'super_admin'::public.app_role) THEN
        v_code := 'FORBIDDEN';
        v_message := 'Only a super admin can change roles.';
    ELSIF p_target_id IS NULL AND p_target_email = '' THEN
        v_code := 'INVALID_TARGET';
        v_message := 'A user id or email address is required.';
    END IF;

    -- -------------------------------------------------------------------
    -- Resolution. Both branches read auth.users, so a target that exists only
    -- in profiles cannot be acted on. See decision 3.
    --
    -- deleted_at IS NULL on every lookup. GoTrue soft-deletes: the row stays
    -- with its email intact. Without the filter a deleted account still
    -- resolves, so admin could be granted to an account that reappears with
    -- that role if it is ever restored, and a legitimate grant could be
    -- refused as TARGET_AMBIGUOUS by an address only a dead row still holds.
    -- -------------------------------------------------------------------
    IF v_code IS NULL THEN
        IF p_target_id IS NOT NULL THEN
            SELECT u.id, u.email::text INTO v_target_id, v_target_email
              FROM auth.users u
             WHERE u.id = p_target_id
               AND u.deleted_at IS NULL;
        ELSE
            SELECT count(*) INTO v_matches
              FROM auth.users u
             WHERE lower(u.email::text) = p_target_email
               AND u.deleted_at IS NULL;

            IF v_matches > 1 THEN
                -- GoTrue does not guarantee one account per address across
                -- every provider configuration -- its unique index on email is
                -- partial (WHERE is_sso_user = false). Picking one of them by
                -- created_at would make "which account got admin" depend on
                -- signup order, so refuse and make the operator use the list,
                -- which passes an unambiguous user_id.
                v_code := 'TARGET_AMBIGUOUS';
                v_message := 'More than one account uses that email address. Grant it from the admin list instead.';
            ELSE
                SELECT u.id, u.email::text INTO v_target_id, v_target_email
                  FROM auth.users u
                 WHERE lower(u.email::text) = p_target_email
                   AND u.deleted_at IS NULL;
            END IF;
        END IF;
    END IF;

    IF v_code IS NULL THEN
        IF v_target_id IS NULL THEN
            v_code := 'USER_NOT_FOUND';
            v_message := 'No Vowza account matches that user. They must sign up first.';
        ELSIF v_target_id = p_actor_id THEN
            v_code := 'SELF_MODIFICATION';
            v_message := 'You cannot change your own roles.';
        ELSE
            SELECT public.has_role(v_target_id, 'super_admin'::public.app_role)
              INTO v_is_super;
            IF v_is_super THEN
                v_code := 'TARGET_PROTECTED';
                v_message := 'That account is a super admin and cannot be modified here.';
            END IF;
        END IF;
    END IF;

    IF v_code IS NOT NULL THEN
        -- Throttle FORBIDDEN only. See decision 6.
        IF v_code = 'FORBIDDEN' THEN
            SELECT EXISTS (
                SELECT 1 FROM vowza_audit.privileged_actions a
                 WHERE a.outcome = 'denied'
                   AND a.detail ->> 'code' = 'FORBIDDEN'
                   AND a.actor_id IS NOT DISTINCT FROM p_actor_id
                   AND a.occurred_at > now() - interval '5 minutes'
            ) INTO v_suppress;
        END IF;

        IF NOT v_suppress THEN
            INSERT INTO vowza_audit.privileged_actions
                (actor_id, actor_email, action, outcome,
                 target_user_id, target_email, subject_role, detail, source)
            VALUES
                (p_actor_id, v_actor_email, 'role.' || coalesce(p_action,'unknown'), 'denied',
                 coalesce(v_target_id, p_target_id),
                 coalesce(v_target_email, nullif(p_target_email,'')),
                 p_role,
                 jsonb_build_object('code', v_code), 'rpc:admin_set_user_role');
        END IF;

        RETURN jsonb_build_object('success', false, 'code', v_code, 'message', v_message);
    END IF;

    -- -------------------------------------------------------------------
    -- Authorized. Mutate and audit atomically; record failures too.
    -- -------------------------------------------------------------------
    BEGIN
        IF p_action = 'grant' THEN
            INSERT INTO public.user_roles (user_id, role, granted_by)
            VALUES (v_target_id, p_role, p_actor_id)
            ON CONFLICT (user_id, role) DO NOTHING;
            v_changed := FOUND;
        ELSE
            DELETE FROM public.user_roles
             WHERE user_id = v_target_id AND role = p_role;
            v_changed := FOUND;
        END IF;

        v_outcome := CASE WHEN v_changed THEN 'applied' ELSE 'noop' END;

        INSERT INTO vowza_audit.privileged_actions
            (actor_id, actor_email, action, outcome,
             target_user_id, target_email, subject_role, detail, source)
        VALUES
            (p_actor_id, v_actor_email, 'role.' || p_action, v_outcome,
             v_target_id, v_target_email, p_role,
             jsonb_build_object('changed', v_changed,
                               'resolved_by', CASE WHEN p_target_id IS NOT NULL
                                                   THEN 'user_id' ELSE 'email' END),
             'rpc:admin_set_user_role');

        RETURN jsonb_build_object(
            'success', true,
            'code', CASE WHEN v_changed THEN 'APPLIED' ELSE 'NO_CHANGE' END,
            'changed', v_changed,
            'target_user_id', v_target_id,
            'message', CASE
                WHEN v_changed AND p_action = 'grant'  THEN 'Role granted.'
                WHEN v_changed                          THEN 'Role removed.'
                WHEN p_action = 'grant'                 THEN 'That user already has this role.'
                ELSE 'That user did not have this role.'
            END);
    EXCEPTION WHEN OTHERS THEN
        -- The failed subtransaction is rolled back before this handler runs,
        -- so this INSERT commits and the failure is recorded.
        INSERT INTO vowza_audit.privileged_actions
            (actor_id, actor_email, action, outcome,
             target_user_id, target_email, subject_role, detail, source)
        VALUES
            (p_actor_id, v_actor_email, 'role.' || p_action, 'failed',
             v_target_id, v_target_email, p_role,
             jsonb_build_object('sqlstate', SQLSTATE, 'sqlerrm', SQLERRM),
             'rpc:admin_set_user_role');

        RETURN jsonb_build_object('success', false, 'code', 'SERVER_ERROR',
                                  'message', 'The role change could not be completed.');
    END;
END;
$$;

COMMENT ON FUNCTION public.admin_set_user_role(uuid, text, public.app_role, uuid, text) IS
    'Grants or revokes the admin role ONLY -- see decision 2 for why provider and customer are refused. EXECUTE is restricted to service_role because the actor is a trusted parameter; widening it creates an impersonation primitive. Called only by the admin-user-roles Edge Function.';

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text, public.app_role, uuid, text)
    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text, public.app_role, uuid, text)
    FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text, public.app_role, uuid, text)
    TO service_role;

-- ===========================================================================
-- Reader: the admin list.
--
-- Actor comes from auth.uid(), so this cannot be impersonated even though
-- authenticated holds EXECUTE. A non-super_admin gets zero rows rather than an
-- error, which keeps the page's empty state honest without leaking whether any
-- admins exist.
--
-- email is auth.users.email, not profiles.email. full_name is still
-- self-declared -- unavoidable, and harmless now that no action keys off it.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.admin_list_admins()
    RETURNS TABLE (
        user_id   uuid,
        role      public.app_role,
        full_name text,
        email     text
    )
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    SELECT d.user_id, d.role, d.full_name, d.email
      FROM (
        SELECT DISTINCT ON (ur.user_id)
               ur.user_id,
               ur.role,
               p.full_name,
               u.email::text AS email
          FROM public.user_roles ur
          LEFT JOIN public.profiles p ON p.id = ur.user_id
          LEFT JOIN auth.users     u ON u.id = ur.user_id
         WHERE ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
           AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
         -- One row per person; super_admin wins when someone holds both.
         ORDER BY ur.user_id, (ur.role = 'super_admin'::public.app_role) DESC
      ) d
     ORDER BY (d.role = 'super_admin'::public.app_role) DESC, d.email NULLS LAST;
$$;

COMMENT ON FUNCTION public.admin_list_admins() IS
    'Super-admin-only listing of admin and super_admin accounts. Returns auth.users.email, not the self-declared profiles.email. Actor derived from auth.uid().';

REVOKE ALL ON FUNCTION public.admin_list_admins() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_admins() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated, service_role;

-- ===========================================================================
-- Reader: the audit trail. Without this the table is write-only, which is how
-- audit trails quietly stop being maintained.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.admin_list_privileged_actions(
        p_limit  integer DEFAULT 100,
        p_before timestamptz DEFAULT NULL
    ) RETURNS TABLE (
        occurred_at    timestamptz,
        actor_email    text,
        action         text,
        outcome        text,
        target_email   text,
        subject_role   public.app_role,
        detail         jsonb
    )
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    SELECT a.occurred_at, a.actor_email, a.action, a.outcome,
           a.target_email, a.subject_role, a.detail
      FROM vowza_audit.privileged_actions a
     WHERE public.has_role(auth.uid(), 'super_admin'::public.app_role)
       AND (p_before IS NULL OR a.occurred_at < p_before)
     ORDER BY a.occurred_at DESC
     LIMIT least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

COMMENT ON FUNCTION public.admin_list_privileged_actions(integer, timestamptz) IS
    'Super-admin-only reader for vowza_audit.privileged_actions. NOT open to admin: decision 1 excludes admins from changing roles because any admin could manufacture peers, and the same argument excludes them from reading who tried. The trail carries actor and target emails, the full denial history and raw SQLSTATE/SQLERRM. Actor derived from auth.uid(), so it cannot be impersonated. Returns zero rows rather than raising.';

REVOKE ALL ON FUNCTION public.admin_list_privileged_actions(integer, timestamptz)
    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_privileged_actions(integer, timestamptz)
    FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_privileged_actions(integer, timestamptz)
    TO authenticated, service_role;

-- ===========================================================================
-- Verification.
-- ===========================================================================
DO $$
DECLARE
    mutator constant text :=
        'public.admin_set_user_role(uuid, text, public.app_role, uuid, text)';
    n int;
BEGIN
    -- Preconditions from 20261201000002. If that migration has not run, the
    -- INSERT below would fail at call time instead of here.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'user_roles'
           AND column_name = 'granted_by'
    ) THEN
        RAISE EXCEPTION
          'FAILED: public.user_roles.granted_by is missing. Apply 20261201000002 first.';
    END IF;

    -- ON CONFLICT (user_id, role) needs a unique constraint over exactly that
    -- column set. Compared as a sorted set, because ON CONFLICT inference is
    -- order-insensitive and a positional comparison against conkey would
    -- reject a constraint declared (role, user_id) that works perfectly well.
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
        RAISE EXCEPTION
          'FAILED: no UNIQUE (user_id, role) on public.user_roles, so ON CONFLICT would error.';
    END IF;

    -- The function owner must be able to read auth.users. Nothing else in this
    -- schema queries it, so this is not a privilege I can infer from the
    -- existing functions -- it gets proved here, not assumed. Both readers and
    -- the mutator resolve their target there; without this the admin panel
    -- would fail at runtime rather than at deploy.
    IF NOT has_schema_privilege(current_user, 'auth', 'USAGE')
       OR NOT has_table_privilege(current_user, 'auth.users', 'SELECT') THEN
        RAISE EXCEPTION
          'FAILED: role % cannot read auth.users, which these functions resolve targets against. Grant USAGE ON SCHEMA auth and SELECT ON auth.users to %, or re-run this migration as a role that has them.',
          current_user, current_user;
    END IF;

    PERFORM 1 FROM auth.users LIMIT 1;   -- exercises it, not just the catalog

    -- auth.users.deleted_at is a GoTrue column, not one this project controls,
    -- and the resolution branches filter on it. A plpgsql body is only syntax
    -- checked at CREATE time, so a missing column would surface as a runtime
    -- error in the admin panel rather than here. Prove it now.
    IF NOT EXISTS (
        SELECT 1 FROM pg_attribute
         WHERE attrelid = 'auth.users'::regclass
           AND attname  = 'deleted_at'
           AND NOT attisdropped
    ) THEN
        RAISE EXCEPTION
          'FAILED: auth.users has no deleted_at column on this GoTrue version. admin_set_user_role filters soft-deleted accounts on it; remove those three predicates before applying, and reconsider how a deleted account is excluded.';
    END IF;

    -- The mutation function must be unreachable by client roles.
    IF EXISTS (
        SELECT 1 FROM unnest(ARRAY['anon','authenticated']) AS r
         WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r)
           AND has_function_privilege(r, mutator, 'EXECUTE')
    ) THEN
        RAISE EXCEPTION
          'FAILED: a client role can execute admin_set_user_role. Because the actor is a trusted parameter, this is an impersonation primitive.';
    END IF;

    IF NOT has_function_privilege('service_role', mutator, 'EXECUTE') THEN
        RAISE EXCEPTION
          'FAILED: service_role cannot execute admin_set_user_role; the Edge Function would 500.';
    END IF;

    -- Exactly one signature, so PostgREST cannot hit an ambiguous overload.
    SELECT count(*) INTO n
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.proname = 'admin_set_user_role';

    IF n <> 1 THEN
        RAISE EXCEPTION
          'FAILED: % overloads of admin_set_user_role exist; expected 1. A CREATE OR REPLACE with changed parameters created an overload instead of replacing.', n;
    END IF;

    IF has_function_privilege('anon', 'public.admin_list_admins()', 'EXECUTE') THEN
        RAISE EXCEPTION 'FAILED: anon can list admin accounts.';
    END IF;

    IF has_function_privilege(
             'anon',
             'public.admin_list_privileged_actions(integer, timestamptz)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FAILED: anon can read the audit log.';
    END IF;

    -- All three must carry an explicit search_path including pg_temp.
    SELECT count(*) INTO n
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public'
       AND p.proname IN ('admin_set_user_role',
                         'admin_list_admins',
                         'admin_list_privileged_actions')
       AND 'search_path=public, pg_temp' = ANY (p.proconfig);

    IF n <> 3 THEN
        RAISE EXCEPTION
          'FAILED: expected 3 functions with search_path=public, pg_temp, found %', n;
    END IF;

    RAISE NOTICE 'OK: role mutation is service_role-only; readers are auth.uid()-gated.';
END $$;

COMMIT;

-- PostgREST caches the schema it exposes. Without this, /rpc/admin_set_user_role
-- and both readers return PGRST202 "could not find the function" until the next
-- unrelated DDL event or an API restart -- and because that failure happens
-- before the function runs, it writes no audit row. The Edge Function would log
-- a 500 and the admin page would say "could not be completed", with nothing in
-- the trail to explain it. That is exactly the blind spot decision 4 exists to
-- remove, so the reload is part of the migration rather than a deploy note.
NOTIFY pgrst, 'reload schema';
