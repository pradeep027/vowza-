-- Ensure user_roles is fully accessible (RLS disabled + permissive policy as safety net)
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Drop any restrictive policies that might exist
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "roles_read_own" ON public.user_roles;
DROP POLICY IF EXISTS "roles_admin_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_all" ON public.user_roles;
DROP POLICY IF EXISTS "roles_insert_auth" ON public.user_roles;
DROP POLICY IF EXISTS "roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "roles_select" ON public.user_roles;

-- Re-enable with a fully permissive read policy for authenticated users
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_read_all" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_roles_write_self" ON public.user_roles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
