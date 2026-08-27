-- 20261205000000_role_management_audit.sql
-- Server-side admin-role management and append-only privileged-action audit.
-- This migration is intentionally separate from the profiles/RLS and storage PRs.
-- It does not apply any production change until reviewed and run in staging first.
--
-- Rollback order:
--   1. Revert the AdminAdmins client and admin-user-roles Edge Function callers.
--   2. Drop the public reader/mutator functions.
--   3. Drop the audit triggers/table/schema if no audit retention is required.
--   4. Drop the optional user_roles provenance columns only after an explicit data-retention decision.

BEGIN;

CREATE SCHEMA IF NOT EXISTS vowza_audit;
REVOKE ALL ON SCHEMA vowza_audit FROM PUBLIC, anon, authenticated;
COMMENT ON SCHEMA vowza_audit IS
  'Append-only privileged-action records. Do not expose through PostgREST.';

CREATE TABLE IF NOT EXISTS vowza_audit.privileged_actions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('applied', 'denied', 'noop', 'failed')),
  target_user_id uuid,
  target_email text,
  subject_role public.app_role,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text
);

CREATE INDEX IF NOT EXISTS privileged_actions_occurred_at_idx
  ON vowza_audit.privileged_actions (occurred_at DESC);
CREATE INDEX IF NOT EXISTS privileged_actions_actor_idx
  ON vowza_audit.privileged_actions (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS privileged_actions_target_idx
  ON vowza_audit.privileged_actions (target_user_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION vowza_audit.reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'vowza_audit.privileged_actions is append-only; % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS privileged_actions_append_only ON vowza_audit.privileged_actions;
CREATE TRIGGER privileged_actions_append_only
  BEFORE UPDATE OR DELETE ON vowza_audit.privileged_actions
  FOR EACH ROW EXECUTE FUNCTION vowza_audit.reject_mutation();

DROP TRIGGER IF EXISTS privileged_actions_no_truncate ON vowza_audit.privileged_actions;
CREATE TRIGGER privileged_actions_no_truncate
  BEFORE TRUNCATE ON vowza_audit.privileged_actions
  FOR EACH STATEMENT EXECUTE FUNCTION vowza_audit.reject_mutation();

REVOKE ALL ON ALL TABLES IN SCHEMA vowza_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA vowza_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA vowza_audit FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA vowza_audit REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA vowza_audit REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA vowza_audit REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Nullable provenance columns preserve the truth for pre-migration rows.
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.user_roles ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS granted_by uuid;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_actor_id uuid,
  p_action text,
  p_role public.app_role,
  p_target_id uuid DEFAULT NULL,
  p_target_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_email text;
  target_id uuid;
  target_email text;
  target_count integer;
  target_is_super boolean := false;
  changed boolean := false;
  code text;
  message text;
BEGIN
  SELECT u.email::text INTO actor_email
    FROM auth.users u
   WHERE u.id = p_actor_id;

  p_target_email := lower(trim(coalesce(p_target_email, '')));

  IF p_action IS NULL OR p_action NOT IN ('grant', 'revoke') THEN
    code := 'INVALID_ACTION';
    message := 'Action must be grant or revoke.';
  ELSIF p_role IS DISTINCT FROM 'admin'::public.app_role THEN
    code := 'ROLE_NOT_MANAGEABLE';
    message := 'Only the admin role can be changed here.';
  ELSIF p_actor_id IS NULL
     OR NOT public.has_role(p_actor_id, 'super_admin'::public.app_role) THEN
    code := 'FORBIDDEN';
    message := 'Only a super admin can change roles.';
  ELSIF p_target_id IS NULL AND p_target_email = '' THEN
    code := 'INVALID_TARGET';
    message := 'A user id or email address is required.';
  END IF;

  IF code IS NULL THEN
    IF p_target_id IS NOT NULL THEN
      SELECT u.id, u.email::text INTO target_id, target_email
        FROM auth.users u
       WHERE u.id = p_target_id;
    ELSE
      SELECT count(*) INTO target_count
        FROM auth.users u
       WHERE lower(u.email::text) = p_target_email;

      IF target_count > 1 THEN
        code := 'TARGET_AMBIGUOUS';
        message := 'More than one account uses that email address. Use the account list instead.';
      ELSE
        SELECT u.id, u.email::text INTO target_id, target_email
          FROM auth.users u
         WHERE lower(u.email::text) = p_target_email;
      END IF;
    END IF;
  END IF;

  IF code IS NULL THEN
    IF target_id IS NULL THEN
      code := 'USER_NOT_FOUND';
      message := 'No Vowza account matches that target.';
    ELSIF target_id = p_actor_id THEN
      code := 'SELF_MODIFICATION';
      message := 'You cannot change your own roles.';
    ELSE
      SELECT public.has_role(target_id, 'super_admin'::public.app_role)
        INTO target_is_super;
      IF target_is_super THEN
        code := 'TARGET_PROTECTED';
        message := 'A super admin cannot be modified here.';
      END IF;
    END IF;
  END IF;

  IF code IS NOT NULL THEN
    INSERT INTO vowza_audit.privileged_actions
      (actor_id, actor_email, action, outcome, target_user_id, target_email,
       subject_role, detail, source)
    VALUES
      (p_actor_id, actor_email, 'role.' || coalesce(p_action, 'unknown'), 'denied',
       coalesce(target_id, p_target_id), coalesce(target_email, nullif(p_target_email, '')),
       p_role, jsonb_build_object('code', code), 'rpc:admin_set_user_role');
    RETURN jsonb_build_object('success', false, 'code', code, 'message', message);
  END IF;

  BEGIN
    IF p_action = 'grant' THEN
      INSERT INTO public.user_roles (user_id, role, granted_by)
      VALUES (target_id, p_role, p_actor_id)
      ON CONFLICT (user_id, role) DO NOTHING;
      changed := FOUND;
    ELSE
      DELETE FROM public.user_roles
       WHERE user_id = target_id AND role = p_role;
      changed := FOUND;
    END IF;

    INSERT INTO vowza_audit.privileged_actions
      (actor_id, actor_email, action, outcome, target_user_id, target_email,
       subject_role, detail, source)
    VALUES
      (p_actor_id, actor_email, 'role.' || p_action,
       CASE WHEN changed THEN 'applied' ELSE 'noop' END,
       target_id, target_email, p_role,
       jsonb_build_object('changed', changed), 'rpc:admin_set_user_role');

    RETURN jsonb_build_object(
      'success', true,
      'code', CASE WHEN changed THEN 'APPLIED' ELSE 'NO_CHANGE' END,
      'changed', changed,
      'target_user_id', target_id
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO vowza_audit.privileged_actions
      (actor_id, actor_email, action, outcome, target_user_id, target_email,
       subject_role, detail, source)
    VALUES
      (p_actor_id, actor_email, 'role.' || p_action, 'failed', target_id, target_email,
       p_role, jsonb_build_object('sqlstate', SQLSTATE), 'rpc:admin_set_user_role');
    RETURN jsonb_build_object('success', false, 'code', 'SERVER_ERROR',
                              'message', 'The role change could not be completed.');
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text, public.app_role, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text, public.app_role, uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS TABLE (user_id uuid, role public.app_role, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ur.user_id, ur.role, p.full_name, u.email::text
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON p.id = ur.user_id
    LEFT JOIN auth.users u ON u.id = ur.user_id
   WHERE ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
     AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
   ORDER BY (ur.role = 'super_admin'::public.app_role) DESC, u.email NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.admin_list_admins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_list_privileged_actions(
  p_limit integer DEFAULT 100,
  p_before timestamptz DEFAULT NULL
)
RETURNS TABLE (
  occurred_at timestamptz,
  actor_email text,
  action text,
  outcome text,
  target_email text,
  subject_role public.app_role,
  detail jsonb
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

REVOKE ALL ON FUNCTION public.admin_list_privileged_actions(integer, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_privileged_actions(integer, timestamptz)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_set_user_role(uuid, text, public.app_role, uuid, text) IS
  'Service-role-only admin-role mutator. The actor id is trusted only because the caller must be a server-side JWT-verified Edge Function.';
COMMENT ON FUNCTION public.admin_list_admins() IS
  'Super-admin-only role listing. Email comes from auth.users rather than self-declared profiles.email.';
COMMENT ON FUNCTION public.admin_list_privileged_actions(integer, timestamptz) IS
  'Super-admin-only reader for the private append-only privileged action trail.';

COMMIT;

NOTIFY pgrst, 'reload schema';
