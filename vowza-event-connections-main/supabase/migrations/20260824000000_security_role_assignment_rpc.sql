-- Vowza security mitigation 1/3
-- Purpose: replace direct client writes to public.user_roles with a narrowly
-- scoped RPC whose EXECUTE privilege is limited to service_role.
--
-- APPLY ORDER:
--   1. Apply this role-assignment RPC.
--   2. Apply 20260824000001_security_otp_verification_rpc.sql.
--   3. Apply 20260824000002_security_lock_sensitive_tables.sql.
--
-- ROLLBACK ORDER:
--   1. Revert 20260824000002_security_lock_sensitive_tables.sql.
--   2. Revert application call sites to their pre-mitigation behavior.
--   3. Drop this function after the application no longer calls it.
--
-- APPLY STATUS: prepared for review only; do not apply from this audit task.

BEGIN;

CREATE OR REPLACE FUNCTION public.assign_user_role(
  p_user_id uuid,
  p_role public.app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN

  IF p_user_id IS NULL OR p_role IS NULL THEN
    RAISE EXCEPTION 'user_id and role are required'
      USING ERRCODE = '22004';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_user_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.assign_user_role(uuid, public.app_role) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, public.app_role) TO service_role;

-- EXECUTE privilege is the caller control. There is intentionally no
-- auth.role() guard in the function body; direct database connections can
-- have no JWT context and therefore no auth.role() value.
COMMENT ON FUNCTION public.assign_user_role(uuid, public.app_role)
  IS 'Trusted role assignment RPC. EXECUTE is granted only to service_role; insertion is idempotent.';

COMMIT;

-- ROLLBACK (run separately, in the order declared above):
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.assign_user_role(uuid, public.app_role);
-- COMMIT;
