-- ════════════════════════════════════════════════════════════════════════════════
-- VOWZA: SELF-BOOKING PREVENTION - RLS POLICIES
-- ════════════════════════════════════════════════════════════════════════════════
-- 
-- BUSINESS RULE:
-- An artist CANNOT book their own packages, but CAN book other artists' packages.
-- 
-- ENFORCEMENT: Row-Level Security (RLS) on INSERT operations for all booking tables
-- 
-- CHECK LOGIC:
-- For each booking INSERT attempt:
--   1. customer_id must equal auth.uid() (user is booking for themselves)
--   2. provider_id must NOT equal any provider_profiles.id owned by auth.uid()
--   
-- If BOTH conditions pass → booking allowed
-- If condition 2 fails → RLS blocks with "new row violates row-level security policy"
--
-- ════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- 1. CATERING BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS catering_bookings_customer_insert ON public.catering_bookings;
CREATE POLICY catering_bookings_customer_insert ON public.catering_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 2. PHOTOGRAPHY PACKAGE BOOKINGS (uses photographer_id column)
-- ─────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS photography_bookings_customer_insert ON public.photography_package_bookings;
CREATE POLICY photography_bookings_customer_insert ON public.photography_package_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = photographer_id AND user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 3. DJ BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS dj_bookings_customer_insert ON public.dj_bookings;
CREATE POLICY dj_bookings_customer_insert ON public.dj_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 4. VIDEOGRAPHY BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS videography_bookings_customer_insert ON public.videography_bookings;
CREATE POLICY videography_bookings_customer_insert ON public.videography_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 5. DRONE BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS drone_bookings_customer_insert ON public.drone_bookings;
CREATE POLICY drone_bookings_customer_insert ON public.drone_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 6. DECORATOR BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS decorator_bookings_customer_insert ON public.decorator_bookings;
CREATE POLICY decorator_bookings_customer_insert ON public.decorator_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 7. MAKEUP BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS makeup_bookings_customer_insert ON public.makeup_bookings;
CREATE POLICY makeup_bookings_customer_insert ON public.makeup_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 8. MEHENDI BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS mehendi_bookings_customer_insert ON public.mehendi_bookings;
CREATE POLICY mehendi_bookings_customer_insert ON public.mehendi_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 9. BAND BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS band_bookings_customer_insert ON public.band_bookings;
CREATE POLICY band_bookings_customer_insert ON public.band_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 10. DANCER BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS dancer_bookings_customer_insert ON public.dancer_bookings;
CREATE POLICY dancer_bookings_customer_insert ON public.dancer_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 11. SINGER BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS singer_bookings_customer_insert ON public.singer_bookings;
CREATE POLICY singer_bookings_customer_insert ON public.singer_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 12. PRIEST BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS priest_bookings_customer_insert ON public.priest_bookings;
CREATE POLICY priest_bookings_customer_insert ON public.priest_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 13. WATER SUPPLY BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS water_bookings_customer_insert ON public.water_bookings;
CREATE POLICY water_bookings_customer_insert ON public.water_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 14. RENTAL BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS rental_bookings_customer_insert ON public.rental_bookings;
CREATE POLICY rental_bookings_customer_insert ON public.rental_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 15. BANQUET BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS banquet_bookings_customer_insert ON public.banquet_bookings;
CREATE POLICY banquet_bookings_customer_insert ON public.banquet_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 16. ANCHOR BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anchor_bookings_customer_insert ON public.anchor_bookings;
CREATE POLICY anchor_bookings_customer_insert ON public.anchor_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ════════════════════════════════════════════════════════════════════════════════
-- After running this SQL, verify all policies were created:
-- SELECT tablename, policyname, cmd, qual FROM pg_policies 
-- WHERE tablename LIKE '%_bookings' AND policyname LIKE '%customer_insert%'
-- ORDER BY tablename;
-- ════════════════════════════════════════════════════════════════════════════════
