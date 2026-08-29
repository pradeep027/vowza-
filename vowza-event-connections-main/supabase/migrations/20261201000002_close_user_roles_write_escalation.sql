-- 20261201000002_close_user_roles_write_escalation.sql
--
-- P0. Closes an UNAUTHENTICATED privilege escalation to admin. The escalation
-- has TWO independent doors and this migration closes both. Closing either one
-- alone accomplishes nothing.
--
-- ---------------------------------------------------------------------------
-- DOOR 1 -- the table itself
-- ---------------------------------------------------------------------------
-- Verbatim from the production schema dump:
--     GRANT ALL ON TABLE "public"."user_roles" TO "anon";
--     CREATE POLICY "Service can insert roles" ON "public"."user_roles"
--       FOR INSERT WITH CHECK (true);          -- no TO clause => PUBLIC
--     CREATE POLICY "user_roles_delete_auth" ON "public"."user_roles"
--       FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));
--
-- The schema has 388 policies and ZERO declared AS RESTRICTIVE, so policies
-- are all PERMISSIVE and OR together: on any given verb the loosest policy
-- decides and the other seven on this table are irrelevant. WITH CHECK (true)
-- is the loosest INSERT expressible.
--
--   => An anonymous caller can POST /rest/v1/user_roles with
--      {"user_id":"<any uuid>","role":"admin"} using only the publishable key
--      that ships in the browser bundle, and become admin.
--   => Any authenticated user can DELETE every row of user_roles in one
--      request, stripping all roles including super_admin.
--
-- ---------------------------------------------------------------------------
-- DOOR 2 -- four SECURITY DEFINER functions that need no privileges at all
-- ---------------------------------------------------------------------------
-- Also verbatim from the production dump:
--     CREATE FUNCTION "public"."make_admin"("p_user_id" "uuid") RETURNS "text"
--         LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" TO 'public'
--     AS $f$ BEGIN
--       INSERT INTO public.user_roles (user_id, role)
--       VALUES (p_user_id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
--       RETURN 'User ' || p_user_id || ' promoted to admin successfully.';
--     END; $f$;
--
--     GRANT ALL ON FUNCTION "public"."make_admin"("p_user_id" "uuid") TO "anon";
--
-- There is no authorization check in that body. Not a weak one -- none. It is
-- SECURITY DEFINER owned by postgres (rolbypassrls = true), so it bypasses
-- both RLS and the table ACL, and EXECUTE is held by anon.
--
--   => POST /rest/v1/rpc/make_admin {"p_user_id":"<any uuid>"} makes any uuid
--      an admin, with no session, and it keeps working no matter what is
--      revoked on the table. Door 1 alone is not a fix.
--
-- Three siblings share the shape, all GRANT ALL to anon and authenticated,
-- none containing an authorization check:
--     make_provider(uuid)                    -- anon self-grants provider
--     approve_artist(uuid, uuid)             -- anon publishes + verifies any
--                                               vendor and stamps verified_by
--                                               with an arbitrary admin's uuid
--     reject_artist(uuid, uuid, text)        -- anon unpublishes + unverifies
--                                               any vendor and deletes their
--                                               provider role: one loop is a
--                                               wipe of every live listing
--
-- Nothing in src/ or supabase/functions/ calls any of the four. They are
-- reachable only as escalation primitives. make_admin and make_provider are
-- dropped; nothing in the database references them either (checked against
-- every function body, trigger, policy and column default in the dump).
-- approve_artist and reject_artist are kept but made service_role-only,
-- because they carry real approval logic that a future server-side vendor
-- approval path should reuse rather than reimplement.
--
-- ---------------------------------------------------------------------------
-- WHAT ACTUALLY DEPENDS ON THE PRIVILEGES BEING REVOKED
-- ---------------------------------------------------------------------------
-- Six browser call sites write user_roles, and an earlier draft of this
-- migration would have broken all six -- four of them silently, because they
-- discard the result. They all move the provider or customer role, never a
-- privileged one:
--
--   src/pages/ProviderRegistration.tsx:352   upsert own    provider  (vendor
--                                            KYC submission -- result discarded)
--   src/pages/ArtistOnboarding.tsx:252       insert own    provider  (discarded)
--   src/pages/AdminDashboard.tsx:339         upsert other  provider  (discarded)
--   src/services/adminVerification.ts:247    upsert other  provider  (checked)
--   src/services/approvalService.ts:125      insert other  provider  (logged
--                                            only; the caller then returns
--                                            success regardless)
--   src/services/approvalService.ts:202      delete other  provider  (discarded)
--   src/contexts/AuthContext.tsx:121         upsert own    customer  (checked)
--
-- So the fix is not "revoke all client writes". It is: make the privileged
-- role VALUES unreachable from any browser, and leave the non-privileged ones
-- working. INSERT and DELETE stay granted to authenticated and are constrained
-- by policy to role IN ('customer','provider'); UPDATE is revoked outright,
-- since no call site updates a role in place and UPDATE would otherwise turn a
-- customer row into an admin row. anon loses every write privilege entirely.
--
-- The only thing that stops working is the add/remove admin buttons in
-- src/pages/admin/AdminAdmins.tsx, which is intended: that path resolved its
-- target through profiles.email, a column the target user writes themselves.
-- Its replacement is public.admin_set_user_role in 20261201000004.
--
-- KNOWN RESIDUAL, tracked separately and deliberately not fixed here: an
-- authenticated user can still self-grant 'provider' without completing
-- registration, and an authenticated user can grant 'provider' to someone
-- else, because three of the six call sites above are admin screens writing
-- another user's row and a user_id = auth.uid() restriction would break them.
-- That is the status quo, it is bounded -- a provider role alone puts nothing
-- in the listings, which additionally require a provider_profiles row with
-- is_verified and is_published -- and closing it properly means moving the
-- provider role behind a definer function the way admin now is. It does not
-- belong in a P0 that has to ship today.
--
-- ---------------------------------------------------------------------------
-- WHY anon KEEPS THE *SELECT* PRIVILEGE (deliberate, do not "tidy" this)
-- ---------------------------------------------------------------------------
-- 40 policies across 23 other tables test admin-ness by inlining
--     EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() ...)
-- instead of calling public.has_role(). A policy expression is evaluated with
-- the privileges of the calling role, and PostgreSQL checks privileges on
-- every relation in the query's range table at executor startup -- OR
-- short-circuiting does not skip that check. Revoking SELECT on user_roles
-- from anon would therefore turn anon reads of any such table into
-- "permission denied for table user_roles". That includes
-- providers_public_read on provider_profiles, which the public /artists and
-- /category/:slug pages depend on. It would take the public site down.
--
-- Restricting which ROWS are visible is safe, and is what this migration does:
-- all 40 of those policies constrain user_roles.user_id = auth.uid(), so
-- own-row visibility satisfies every one of them. For anon, auth.uid() is
-- NULL, no policy matches, and the subquery correctly yields false rather than
-- erroring.
--
-- Removing anon's SELECT is a separate change that must first rewrite those 40
-- policies onto has_role(). Tracked as its own item.
-- ---------------------------------------------------------------------------

BEGIN;

-- ===========================================================================
-- 1. Table privileges.
--
--    REVOKE ALL then GRANT back exactly what is needed, rather than naming
--    verbs to revoke. The baseline granted ALL, which also conferred
--    REFERENCES and TRIGGER; a verb list would have left both in place, and
--    TRIGGER on this table plus CREATE on schema public is another way to get
--    code running on someone else's INSERT.
--
--    PUBLIC must be named explicitly: anon and authenticated inherit through
--    PUBLIC, so revoking only from them is a no-op.
-- ===========================================================================
REVOKE ALL ON TABLE public.user_roles FROM PUBLIC, anon, authenticated;

-- anon: read only, and only for the 40 dependent policies described above.
-- RLS gives it no SELECT policy, so it reads zero rows.
GRANT SELECT ON TABLE public.user_roles TO anon;

-- authenticated: read, plus the non-privileged writes the six call sites need.
-- No UPDATE. Values are constrained by the policies in step 3.
GRANT SELECT, INSERT, DELETE ON TABLE public.user_roles TO authenticated;

-- ===========================================================================
-- 2. Drop all eight existing policies. Because permissive policies OR, a
--    partial cleanup leaves the escalation open, so this is all-or-nothing.
--    Names are quoted exactly as they appear in the production catalog.
--
--    This migration's own five names are dropped first as well, so the file is
--    replayable: CREATE POLICY has no OR REPLACE and would abort with 42710 on
--    a second apply or on a fresh database that already ran it.
-- ===========================================================================
DROP POLICY IF EXISTS "Service can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role full access" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete_auth"   ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_auth"   ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_read_all"      ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_read_auth"     ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_write_self"    ON public.user_roles;

DROP POLICY IF EXISTS "user_roles_select_own"        ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_admin"      ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_unprivileged" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete_unprivileged" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_service_all"      ON public.user_roles;

-- ===========================================================================
-- 3. Replacement policy set.
--
--    has_role() is SECURITY DEFINER owned by a BYPASSRLS role, so calling it
--    from a policy ON user_roles does not recurse into this policy set. Its
--    second argument is public.app_role -- the cast is required, and an
--    untyped literal would look for a text overload that does not exist. Do
--    not create one.
-- ===========================================================================
CREATE POLICY "user_roles_select_own" ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "user_roles_select_admin" ON public.user_roles
    FOR SELECT TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    );

-- The load-bearing one. The role VALUE restriction is what closes the
-- escalation on this verb: an authenticated caller can create customer and
-- provider rows, and 'admin' / 'super_admin' are not expressible at all. The
-- actor restriction that follows it permits self-service (vendor registration,
-- artist onboarding, the customer row seeded at signup) and admin-mediated
-- grants (the three admin approval screens), and nothing else.
CREATE POLICY "user_roles_insert_unprivileged" ON public.user_roles
    FOR INSERT TO authenticated
    WITH CHECK (
        role IN ('customer'::public.app_role, 'provider'::public.app_role)
        AND (
            user_id = auth.uid()
            OR public.has_role(auth.uid(), 'admin'::public.app_role)
            OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
        )
    );

-- Revoking a provider role is an admin action (approvalService.ts:202, on
-- rejection). Self-deletion is not permitted: a user removing their own
-- provider row while an approved provider_profiles row survives is the
-- half-provisioned vendor state this whole change is trying to avoid.
CREATE POLICY "user_roles_delete_unprivileged" ON public.user_roles
    FOR DELETE TO authenticated
    USING (
        role IN ('customer'::public.app_role, 'provider'::public.app_role)
        AND (
            public.has_role(auth.uid(), 'admin'::public.app_role)
            OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
        )
    );

-- service_role retains GRANT ALL from the baseline. It gets an explicit policy
-- rather than relying on BYPASSRLS, so Edge Functions keep working whether or
-- not the role carries that attribute. Scoped TO service_role rather than the
-- baseline's PUBLIC + auth.role() test.
CREATE POLICY "user_roles_service_all" ON public.user_roles
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 4. Door 2. Remove the definer functions that make door 1 irrelevant.
--
--    DROP, not gate: make_admin and make_provider have no callers anywhere in
--    the application or the database, and a gated version of "promote this
--    uuid" is still a primitive worth not having. Signatures are given
--    explicitly so a same-named overload cannot be dropped by accident.
-- ===========================================================================
DROP FUNCTION IF EXISTS public.make_admin(uuid);
DROP FUNCTION IF EXISTS public.make_provider(uuid);

-- approve_artist and reject_artist are kept: they move provider_profiles
-- verification state, the user_roles row and the notification together, which
-- is the correct shape for a server-side vendor approval path to build on.
-- What they must not be is callable by the public. PUBLIC is named because
-- EXECUTE is held through it as well as directly.
REVOKE ALL ON FUNCTION public.approve_artist(uuid, uuid)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_artist(uuid, uuid, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_artist(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_artist(uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.approve_artist(uuid, uuid) IS
    'service_role only. Contains NO authorization check -- p_admin_user_id is a trusted parameter written straight to provider_profiles.verified_by. Never grant EXECUTE to anon or authenticated. See 20261201000002.';
COMMENT ON FUNCTION public.reject_artist(uuid, uuid, text) IS
    'service_role only. Contains NO authorization check. Deletes the provider role and unpublishes the listing, so a client-callable version is a mass vendor takedown. Never grant EXECUTE to anon or authenticated. See 20261201000002.';

-- handle_new_user() also writes user_roles and also holds EXECUTE for anon,
-- and is deliberately left alone. It RETURNS trigger, so a direct call fails
-- with 0A000 "trigger functions can only be called as triggers" -- there is no
-- exploit, and signup is the one flow not worth risking for a hygiene fix. It
-- is excluded by name from the assertion below rather than silently ignored.

-- ===========================================================================
-- 5. Provenance columns. Their absence is why no role grant on this database
--    can be dated or attributed.
--
--    Deliberately nullable with the DEFAULT set AFTER the column is added:
--    adding a column WITH a default backfills every existing row, which would
--    stamp all pre-existing grants with this migration's timestamp and
--    manufacture false audit history. Existing rows stay NULL, meaning
--    "unknown", which is the truth. New rows get now().
-- ===========================================================================
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.user_roles ALTER COLUMN created_at SET DEFAULT now();

-- granted_by carries NO foreign key to auth.users, for two reasons. On the
-- merits: ON DELETE SET NULL / CASCADE would erase the record of who granted a
-- role the moment that admin's account is deleted, which defeats the point of
-- an audit column -- provenance must survive the actor. Operationally: adding
-- an FK requires REFERENCES on auth.users, and if postgres lacks it the
-- statement aborts the whole transaction and blocks this P0 over a
-- non-essential column.
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS granted_by uuid;

COMMENT ON COLUMN public.user_roles.created_at IS
    'When the role was granted. NULL for rows predating 20261201000002.';
COMMENT ON COLUMN public.user_roles.granted_by IS
    'auth.users.id of the actor who granted this role; populated by admin_set_user_role. NULL for rows predating 20261201000002 and for self-service rows.';

-- ===========================================================================
-- 6. Self-verification, part 1: catalog shape.
-- ===========================================================================
DO $catalog$
DECLARE
    v_bad     text;
    v_count   int;
BEGIN
    -- 6a. Exact grant shape. Named verbs rather than a loop over ALL, because
    --     the point is that INSERT and DELETE are *retained* here and UPDATE,
    --     TRUNCATE, REFERENCES and TRIGGER are not.
    SELECT string_agg(r || ':' || p, ', ' ORDER BY r, p) INTO v_bad
      FROM unnest(ARRAY['anon','authenticated'])                            AS r,
           unnest(ARRAY['UPDATE','TRUNCATE','REFERENCES','TRIGGER'])        AS p
     WHERE has_table_privilege(r, 'public.user_roles', p);
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'FAILED: public.user_roles still grants % -- a grant outside PUBLIC/anon/authenticated is present.', v_bad;
    END IF;

    SELECT string_agg(p, ', ' ORDER BY p) INTO v_bad
      FROM unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE']) AS p
     WHERE has_table_privilege('anon', 'public.user_roles', p);
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'FAILED: anon still holds % on public.user_roles.', v_bad;
    END IF;

    -- 6b. Precondition, not an effect of this migration: the 40 inlined
    --     EXISTS(...user_roles...) policies on 23 other tables need anon to
    --     hold SELECT. If this fails, the public site is already broken and
    --     something revoked it before now.
    IF NOT has_table_privilege('anon', 'public.user_roles', 'SELECT') THEN
        RAISE EXCEPTION 'FAILED: anon does not hold SELECT on public.user_roles. 40 policies on 23 other tables inline a subquery over this table and will raise permission denied, including providers_public_read on the public artists page.';
    END IF;
    IF NOT has_table_privilege('authenticated', 'public.user_roles', 'INSERT') THEN
        RAISE EXCEPTION 'FAILED: authenticated lost INSERT on public.user_roles; vendor registration and artist onboarding write it directly.';
    END IF;

    -- 6c. No policy this migration did not create survives. This subsumes the
    --     write-policy check it replaces and closes a gap that check had: a
    --     misspelled name in the DROP list above makes DROP POLICY IF EXISTS a
    --     silent no-op, and a surviving FOR SELECT USING (true) -- which
    --     user_roles_read_all is -- would let every authenticated user
    --     enumerate every role row while this block reported success.
    SELECT count(*), string_agg(policyname, ', ' ORDER BY policyname)
      INTO v_count, v_bad
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'user_roles'
       AND policyname NOT IN ('user_roles_select_own', 'user_roles_select_admin',
                              'user_roles_insert_unprivileged',
                              'user_roles_delete_unprivileged',
                              'user_roles_service_all');
    IF v_count > 0 THEN
        RAISE EXCEPTION 'FAILED: % unexpected policy/policies survived on public.user_roles: %. A name in the DROP list does not match the catalog.', v_count, v_bad;
    END IF;

    -- 6d. Door 2, generalised. Derived from pg_proc rather than a hand-list,
    --     so a sixth definer function that writes user_roles cannot silently
    --     reopen this. handle_new_user is excluded for the reason given above.
    SELECT count(*), string_agg(p.oid::regprocedure::text, ', ' ORDER BY p.oid::regprocedure::text)
      INTO v_count, v_bad
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef
       AND p.proname <> 'handle_new_user'
       AND p.prosrc ~* '(insert\s+into|update|delete\s+from)\s+(public\.)?user_roles'
       AND (has_function_privilege('anon',          p.oid, 'EXECUTE')
         OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
    IF v_count > 0 THEN
        RAISE EXCEPTION 'FAILED: % SECURITY DEFINER function(s) writing user_roles are still EXECUTE-able by a client role: %. These bypass RLS and the table ACL, so the escalation is open regardless of the grants above.', v_count, v_bad;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname IN ('make_admin','make_provider')) THEN
        RAISE EXCEPTION 'FAILED: public.make_admin or public.make_provider still exists -- an overload with different argument types was not dropped.';
    END IF;

    RAISE NOTICE 'OK: catalog shape verified.';
END $catalog$;

-- ===========================================================================
-- 7. Self-verification, part 2: a functional probe.
--
--    Catalog inspection proves the grants and policy names are what was
--    intended. It does not prove the policy EXPRESSIONS deny what they are
--    supposed to deny -- that depends on operator resolution, enum casts and
--    auth.uid() behaviour, none of which are visible in pg_policies. So
--    actually try the escalation as authenticated and require it to fail.
--
--    The probe user_id is the all-zeros uuid, which is not in auth.users, so
--    the foreign key is a second net under everything here. That also gives a
--    clean two-sided signal without needing a real account:
--        42501 insufficient_privilege -> RLS blocked the row
--        23503 foreign_key_violation  -> RLS ALLOWED the row, FK stopped it
--    For 'admin' the required answer is 42501. For 'provider' it is 23503 --
--    if a provider self-insert comes back 42501, this migration has broken
--    vendor registration and must not be allowed to commit.
--
--    Everything runs in a subtransaction that is unconditionally rolled back.
-- ===========================================================================
DO $probe$
DECLARE
    v_uid   constant uuid := '00000000-0000-0000-0000-000000000000';
    v_admin    text;
    v_provider text;
    v_seen     uuid;
BEGIN
    -- set_config rather than SET LOCAL: plpgsql parses a dotted custom GUC
    -- name in a SET statement inconsistently across versions, and set_config's
    -- third argument is exactly SET LOCAL's transaction scoping. 'role' is a
    -- real GUC, so this is also how the role is assumed and released.
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
        '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);

    -- Verify the harness before trusting its verdict. If auth.uid() does not
    -- read this GUC on this Supabase version, every probe below would come
    -- back "blocked" and look like a passing security check while actually
    -- testing nothing.
    SELECT auth.uid() INTO v_seen;
    IF v_seen IS DISTINCT FROM v_uid THEN
        PERFORM set_config('role', 'none', true);
        RAISE EXCEPTION 'FAILED: probe harness cannot impersonate -- auth.uid() returned % instead of %. Not a policy failure; the probe below would be vacuous, so this migration refuses to report success.', coalesce(v_seen::text,'NULL'), v_uid;
    END IF;

    BEGIN
        BEGIN
            INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin');
            v_admin := 'INSERTED';
        EXCEPTION
            WHEN insufficient_privilege  THEN v_admin := 'BLOCKED';
            WHEN foreign_key_violation   THEN v_admin := 'RLS_ALLOWED';
            WHEN OTHERS                  THEN v_admin := 'ERROR ' || SQLSTATE;
        END;

        BEGIN
            INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'provider');
            v_provider := 'INSERTED';
        EXCEPTION
            WHEN insufficient_privilege  THEN v_provider := 'BLOCKED';
            WHEN foreign_key_violation   THEN v_provider := 'RLS_ALLOWED';
            WHEN OTHERS                  THEN v_provider := 'ERROR ' || SQLSTATE;
        END;

        RAISE EXCEPTION 'rollback_probe';
    EXCEPTION
        WHEN raise_exception THEN
            IF SQLERRM <> 'rollback_probe' THEN
                PERFORM set_config('role', 'none', true);
                RAISE;
            END IF;
    END;

    PERFORM set_config('role', 'none', true);

    IF v_admin <> 'BLOCKED' THEN
        RAISE EXCEPTION 'FAILED: an authenticated caller could still insert role=admin (probe result: %). THE ESCALATION IS OPEN. Expected BLOCKED.', v_admin;
    END IF;
    IF v_provider <> 'RLS_ALLOWED' THEN
        RAISE EXCEPTION 'FAILED: an authenticated caller can no longer self-insert role=provider (probe result: %). Expected RLS_ALLOWED. This migration would break vendor registration at ProviderRegistration.tsx:352 and artist onboarding at ArtistOnboarding.tsx:252, both of which discard the error and would fail silently.', v_provider;
    END IF;

    RAISE NOTICE 'OK: role=admin refused, role=provider permitted, both verified by execution rather than inspection.';
END $probe$;

COMMIT;

-- Dropping two functions changes the shape PostgREST exposes. Without this the
-- API's cached schema keeps advertising /rpc/make_admin until the next
-- unrelated DDL event or restart.
NOTIFY pgrst, 'reload schema';
