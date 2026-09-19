-- ===========================================================================
-- 20261201000012_platform_settings_lockdown_anon.sql  [PHASE 0b / STAGE 2]
--
-- PURPOSE
--   Remove anonymous direct read access to platform_settings now that the
--   application's only public consumer (usePlatformFee.ts) reads through the
--   key-fixed SECURITY DEFINER RPC get_public_platform_fee() (Stage 1,
--   20261201000011 — deployed and verified BEFORE this migration runs).
--
--   Prerequisite (verified 2026-09-18): the live key set is exactly
--   {platform_fee}; no other key exists to leak.
--
-- BEFORE
--   Policies: anyone_can_read_settings  FOR SELECT USING (true)   <- anon + every authenticated row
--             admin_can_update_settings FOR UPDATE (admin/super_admin EXISTS)
--             admin_can_insert_settings FOR INSERT (admin/super_admin EXISTS)
--   Grants:   baseline table grants (anon/authenticated SELECT etc.)
--
-- AFTER
--   Policies: admin_can_read_settings   FOR SELECT TO authenticated (admin/super_admin EXISTS)  [new]
--             admin_can_update_settings / admin_can_insert_settings  [unchanged]
--   Grants:   SELECT/UPDATE/INSERT -> authenticated; ALL -> service_role; anon -> none
--   anon: zero table access (401/permission denied via PostgREST).
--   authenticated non-admin: can connect but zero rows match (admin-gated policy), and
--             no anonymous key enumeration is possible.
--
-- DATA: none read, none changed. No other table/policy/function touched.
--
-- ROLLBACK (owner session):
--   CREATE POLICY "anyone_can_read_settings" ON public.platform_settings
--     FOR SELECT USING (true);
--   GRANT SELECT ON TABLE public.platform_settings TO anon;
--   NOTIFY pgrst, 'reload schema';
-- ===========================================================================

BEGIN;

-- 1. The broad public read policy goes.
DROP POLICY IF EXISTS "anyone_can_read_settings" ON public.platform_settings;

-- 2. Admin row-read replaces it. Same authorization predicate the table's
--    UPDATE/INSERT policies already use, so the admin surface is unchanged.
CREATE POLICY "admin_can_read_settings" ON public.platform_settings
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('admin', 'super_admin')
        )
    );

-- 3. Grants made explicit; nothing left implicit.
REVOKE ALL ON TABLE public.platform_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE, INSERT ON TABLE public.platform_settings TO authenticated;
GRANT ALL ON TABLE public.platform_settings TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Assertions: abort if the end state is not exactly as designed.
-- ---------------------------------------------------------------------------
DO $assert$
DECLARE
    v_public_read  int;
    v_anon_grants  text;
    v_admin_select int;
BEGIN
    -- The broad policy must be gone.
    SELECT count(*) INTO v_public_read
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'platform_settings'
       AND policyname = 'anyone_can_read_settings';
    IF v_public_read <> 0 THEN
        RAISE EXCEPTION 'FAILED: anyone_can_read_settings still exists.';
    END IF;

    -- The admin SELECT policy must exist, TO authenticated.
    SELECT count(*) INTO v_admin_select
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'platform_settings'
       AND policyname = 'admin_can_read_settings'
       AND cmd = 'SELECT'
       AND roles::text LIKE '%authenticated%';
    IF v_admin_select <> 1 THEN
        RAISE EXCEPTION 'FAILED: admin_can_read_settings missing or mis-scoped.';
    END IF;

    -- anon must hold no privilege on the table.
    SELECT string_agg(grantee || ':' || privilege_type, ', ') INTO v_anon_grants
      FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = 'platform_settings'
       AND grantee IN ('anon', 'PUBLIC');
    IF v_anon_grants IS NOT NULL THEN
        RAISE EXCEPTION 'FAILED: anon/PUBLIC grants remain on platform_settings: %.', v_anon_grants;
    END IF;

    RAISE NOTICE 'platform_settings locked down: broad anon read removed, admin-gated SELECT in place.';
END;
$assert$;

COMMIT;

NOTIFY pgrst, 'reload schema';
