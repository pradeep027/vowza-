-- ============================================================
-- ADMIN ACCESS FIX — Run this in Supabase SQL Editor
-- Fixes the admin redirect loop caused by RLS blocking role reads
-- ============================================================

-- Step 1: Make user_roles readable by the authenticated user themselves
-- (so they can read their OWN roles — needed for AuthContext)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select"         ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert"         ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_all"            ON public.user_roles;
DROP POLICY IF EXISTS "roles_read_own"            ON public.user_roles;
DROP POLICY IF EXISTS "roles_admin_all"           ON public.user_roles;

-- ANY authenticated user can read their OWN roles
CREATE POLICY "roles_read_own"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

-- Authenticated users can insert roles (for seeding customer role on signup)
CREATE POLICY "roles_insert_auth"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Step 2: Confirm your admin role exists
-- Replace with your actual email if needed
-- SELECT id FROM auth.users WHERE email = 'your@email.com';

-- Step 3: Verify admin row exists
SELECT u.email, ur.role, ur.created_at
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'admin';

-- If the query above returns nothing, run this (replace with your UUID):
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'admin' FROM auth.users WHERE email = 'your@email.com'
-- ON CONFLICT (user_id, role) DO NOTHING;

-- Step 4: Verify you can now read your own roles
-- (test by running while logged in as admin via Supabase auth.uid())
SELECT role FROM public.user_roles WHERE user_id = auth.uid();
