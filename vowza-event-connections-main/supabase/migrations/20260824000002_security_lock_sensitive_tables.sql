-- Vowza security mitigation 3/3
-- Purpose: lock the sensitive role and OTP tables to service_role only after
-- trusted RPCs exist for the required server-side operations.
--
-- APPLY ORDER:
--   1. 20260824000000_security_role_assignment_rpc.sql.
--   2. 20260824000001_security_otp_verification_rpc.sql.
--   3. Apply this RLS and helper migration.
--
-- ROLLBACK ORDER:
--   1. Revert this migration’s RLS policies and table grants.
--   2. Revert application call sites to their pre-mitigation behavior.
--   3. Drop the has_role(app_role) helper, then the RPC functions from
--      migrations 1 and 2.
--
-- APPLY STATUS: prepared for review only; do not apply from this audit task.

BEGIN;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Remove the currently broad role-table policies.
DROP POLICY IF EXISTS "Service can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role full access" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete_auth" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_auth" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_read_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_read_auth" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_write_self" ON public.user_roles;

-- Remove the currently broad OTP and login-attempt policies.
DROP POLICY IF EXISTS "All users can view login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Service can insert login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Service can insert rate limits" ON public.otp_rate_limits;
DROP POLICY IF EXISTS "Users can insert OTP verifications" ON public.otp_verifications;
DROP POLICY IF EXISTS "Users can update OTP verifications" ON public.otp_verifications;
DROP POLICY IF EXISTS "Users can verify OTP" ON public.otp_verifications;

-- user_roles keeps only authenticated users’ own-role read path for client
-- authorization checks. All role writes remain service_role-only.
CREATE POLICY "user_roles_service_role_only"
  ON public.user_roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "user_roles_authenticated_read_own"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "otp_verifications_service_role_only"
  ON public.otp_verifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "otp_rate_limits_service_role_only"
  ON public.otp_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "login_attempts_service_role_only"
  ON public.login_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- The service role is the only table-level writer/reader for the OTP and
-- audit tables. Authenticated clients retain only the narrow user_roles read
-- policy above; anon has no table privileges on any of these relations.
REVOKE ALL ON TABLE
  public.user_roles,
  public.otp_verifications,
  public.otp_rate_limits,
  public.login_attempts
FROM anon, authenticated;

-- The narrow authenticated SELECT policy requires the corresponding table
-- privilege. Authenticated clients receive no other privilege on user_roles.
GRANT SELECT ON TABLE public.user_roles TO authenticated;

-- Restore authenticated role checks through a narrowly scoped helper rather
-- than exposing user_roles broadly. This overload intentionally coexists with
-- the existing has_role(uuid, app_role) function.
CREATE OR REPLACE FUNCTION public.has_role(p_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles
     WHERE user_id = auth.uid()
       AND role = p_role
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(public.app_role) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role) TO authenticated;

COMMENT ON FUNCTION public.has_role(public.app_role)
  IS 'Returns whether the current authenticated user has the supplied role.';

COMMIT;

-- ROLLBACK (run separately, in the order declared in the header):
-- STEP 1: revert the RLS policies and table privileges in this block.
-- STEP 2: revert application call sites to their pre-mitigation behavior.
-- STEP 3: after the application no longer uses the helper/RPCs, drop the
--         helper below and then the functions from migrations 1 and 2.
-- BEGIN;
--
-- DROP POLICY IF EXISTS "user_roles_service_role_only" ON public.user_roles;
-- DROP POLICY IF EXISTS "otp_verifications_service_role_only" ON public.otp_verifications;
-- DROP POLICY IF EXISTS "otp_rate_limits_service_role_only" ON public.otp_rate_limits;
-- DROP POLICY IF EXISTS "login_attempts_service_role_only" ON public.login_attempts;
--
-- CREATE POLICY "Service can insert roles"
--   ON public.user_roles FOR INSERT TO public
--   WITH CHECK (true);
-- CREATE POLICY "Service role full access"
--   ON public.user_roles FOR ALL TO public
--   USING (auth.role() = 'service_role'::text)
--   WITH CHECK (auth.role() = 'service_role'::text);
-- CREATE POLICY "Users can view own roles"
--   ON public.user_roles FOR SELECT TO public
--   USING (auth.uid() = user_id);
-- CREATE POLICY "user_roles_delete_auth"
--   ON public.user_roles FOR DELETE TO public
--   USING (auth.role() = 'authenticated'::text);
-- CREATE POLICY "user_roles_insert_auth"
--   ON public.user_roles FOR INSERT TO public
--   WITH CHECK (auth.role() = 'authenticated'::text);
-- CREATE POLICY "user_roles_read_all"
--   ON public.user_roles FOR SELECT TO authenticated
--   USING (true);
-- CREATE POLICY "user_roles_read_auth"
--   ON public.user_roles FOR SELECT TO public
--   USING (auth.role() = 'authenticated'::text);
-- CREATE POLICY "user_roles_write_self"
--   ON public.user_roles FOR ALL TO authenticated
--   USING (user_id = auth.uid())
--   WITH CHECK (user_id = auth.uid());
--
-- CREATE POLICY "All users can view login attempts"
--   ON public.login_attempts FOR SELECT TO public
--   USING (true);
-- CREATE POLICY "Service can insert login attempts"
--   ON public.login_attempts FOR INSERT TO public
--   WITH CHECK (true);
-- CREATE POLICY "Service can insert rate limits"
--   ON public.otp_rate_limits FOR INSERT TO public
--   WITH CHECK (true);
-- CREATE POLICY "Users can insert OTP verifications"
--   ON public.otp_verifications FOR INSERT TO public
--   WITH CHECK (true);
-- CREATE POLICY "Users can update OTP verifications"
--   ON public.otp_verifications FOR UPDATE TO public
--   USING (true);
-- CREATE POLICY "Users can verify OTP"
--   ON public.otp_verifications FOR SELECT TO public
--   USING (true);
--
-- GRANT ALL ON TABLE
--   public.user_roles,
--   public.otp_verifications,
--   public.otp_rate_limits,
--   public.login_attempts
-- TO anon, authenticated;
--
-- DROP FUNCTION IF EXISTS public.has_role(public.app_role);
-- COMMIT;
--
-- STEP 3 continuation, after this rollback block and application rollback:
-- DROP FUNCTION IF EXISTS public.assign_user_role(uuid, public.app_role);
-- DROP FUNCTION IF EXISTS public.verify_otp(text, text, text, integer);
