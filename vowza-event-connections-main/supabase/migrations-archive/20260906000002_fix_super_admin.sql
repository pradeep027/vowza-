-- Force assign super_admin role to kammaripradeep265@gmail.com
-- Also keep admin role so isAdmin check works in all places
DO $$ 
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'kammaripradeep265@gmail.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    -- Ensure super_admin role exists for this user
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'super_admin') THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'super_admin');
    END IF;
    -- Also ensure admin role exists (so isAdmin checks pass everywhere)
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'admin') THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin');
    END IF;
    RAISE NOTICE 'Super admin roles confirmed for user %', v_uid;
  ELSE
    RAISE NOTICE 'User not found';
  END IF;
END $$;
