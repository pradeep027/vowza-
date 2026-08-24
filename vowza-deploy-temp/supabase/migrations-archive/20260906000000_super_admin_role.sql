-- Bootstrap super_admin role for the designated Super Admin account
-- Email: kammaripradeep265@gmail.com

-- First add 'super_admin' to the app_role enum if it doesn't exist
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add super_admin role if user exists
DO $$ 
DECLARE
  v_uid uuid;
BEGIN
  -- Find the user by email in auth.users
  SELECT id INTO v_uid FROM auth.users WHERE email = 'kammaripradeep265@gmail.com' LIMIT 1;
  
  IF v_uid IS NOT NULL THEN
    -- Remove existing admin role if present (will be replaced by super_admin)
    DELETE FROM public.user_roles WHERE user_id = v_uid AND role = 'admin';
    
    -- Insert super_admin role (idempotent)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'super_admin')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Super admin role assigned to %', v_uid;
  ELSE
    RAISE NOTICE 'User kammaripradeep265@gmail.com not found — will be assigned on next login';
  END IF;
END $$;
