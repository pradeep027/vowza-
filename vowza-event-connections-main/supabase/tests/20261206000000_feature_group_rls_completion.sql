-- Local/review-only assertions for 20261206000000_feature_group_rls_completion.sql.
-- Run after the migration in a disposable replay or staging database.
-- No production data is selected or modified.

DO $$
DECLARE
  table_name text;
  tables text[] := ARRAY[
    'anchor_bookings', 'auth_promotion_media', 'auth_promotion_videos',
    'band_bookings', 'banquet_bookings', 'booking_locations',
    'dancer_bookings', 'decorator_bookings', 'dj_bookings', 'drone_bookings',
    'makeup_bookings', 'mehendi_bookings', 'priest_bookings',
    'rental_bookings', 'singer_bookings', 'videography_bookings',
    'water_bookings'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    IF has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
       OR has_table_privilege('anon', format('public.%I', table_name), 'UPDATE')
       OR has_table_privilege('anon', format('public.%I', table_name), 'DELETE')
       OR has_table_privilege('anon', format('public.%I', table_name), 'TRUNCATE')
       OR has_table_privilege('anon', format('public.%I', table_name), 'TRIGGER') THEN
      RAISE EXCEPTION 'anon write privilege remains on %', table_name;
    END IF;
  END LOOP;

  IF has_table_privilege('anon', 'public.auth_promotion_video_views', 'SELECT') THEN
    RAISE EXCEPTION 'anon SELECT privilege remains on auth_promotion_video_views';
  END IF;
  IF has_table_privilege('anon', 'public.photography_cart_items', 'DELETE') THEN
    RAISE EXCEPTION 'anon DELETE privilege remains on photography_cart_items';
  END IF;
  IF has_table_privilege('authenticated', 'public.audit_log', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated INSERT privilege remains on audit_log';
  END IF;
  IF has_table_privilege('authenticated', 'public.security_events', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated DELETE privilege remains on security_events';
  END IF;
END $$;

DO $$
DECLARE
  table_name text;
  expected text[] := ARRAY['booking_start_otps', 'profiles', 'reviews'];
BEGIN
  FOREACH table_name IN ARRAY expected LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = table_name
        AND c.relrowsecurity
        AND c.relforcerowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS is not enabled and forced on %', table_name;
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can insert own profile' AND cmd = 'INSERT' AND roles = '{authenticated}') THEN
    RAISE EXCEPTION 'profiles INSERT owner policy missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can delete own profile' AND cmd = 'DELETE' AND roles = '{authenticated}') THEN
    RAISE EXCEPTION 'profiles DELETE owner policy missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reviews' AND policyname = 'Customers can update own reviews' AND cmd = 'UPDATE' AND roles = '{authenticated}') THEN
    RAISE EXCEPTION 'reviews UPDATE owner policy missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reviews' AND policyname = 'Customers can delete own reviews' AND cmd = 'DELETE' AND roles = '{authenticated}') THEN
    RAISE EXCEPTION 'reviews DELETE owner policy missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'photography_cart_items' AND policyname = 'Customers can delete own photography cart items' AND cmd = 'DELETE' AND roles = '{authenticated}') THEN
    RAISE EXCEPTION 'photography_cart_items DELETE owner policy missing';
  END IF;
END $$;
