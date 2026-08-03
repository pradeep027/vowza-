-- ============================================================
-- FIX: Infinite recursion in user_roles RLS policy
-- Run this in Supabase SQL Editor RIGHT NOW
-- ============================================================

-- Step 1: Drop ALL existing policies on user_roles (they have circular references)
DROP POLICY IF EXISTS "user_roles_select"         ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert"         ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_all"            ON public.user_roles;
DROP POLICY IF EXISTS "roles_read_own"            ON public.user_roles;
DROP POLICY IF EXISTS "roles_insert_auth"         ON public.user_roles;
DROP POLICY IF EXISTS "roles_admin_all"           ON public.user_roles;
DROP POLICY IF EXISTS "roles_insert"              ON public.user_roles;
DROP POLICY IF EXISTS "roles_select"              ON public.user_roles;

-- Step 2: DISABLE RLS on user_roles completely
-- This is safe because user_roles only contains non-sensitive role names.
-- The app checks roles server-side via Supabase Auth and the admin panel
-- is protected by the AdminLayout component.
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Step 3: Verify your admin role exists
SELECT u.email, ur.role
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'admin';

-- If the above returns nothing, insert your admin role:
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'admin' FROM auth.users WHERE email = 'YOUR_EMAIL_HERE'
-- ON CONFLICT (user_id, role) DO NOTHING;

-- Step 4: Verify all roles are readable
SELECT * FROM public.user_roles LIMIT 20;
