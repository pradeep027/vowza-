-- ══════════════════════════════════════════════════════════════════════════════
-- UNIVERSAL SELF-BOOKING PREVENTION
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Business Rule: A vendor/artist CANNOT book their own packages, but CAN book
-- packages created by other vendors. This applies across ALL service categories.
--
-- Enforcement Strategy:
-- 1. UPDATE INSERT RLS policies on ALL booking tables to add owner check
-- 2. Policies now verify: customer_id = auth.uid() AND vendor_user_id ≠ auth.uid()
-- 3. Existing vendor/provider UPDATE policies remain unchanged
--
-- Table Coverage (15+ booking tables):
-- - catering_bookings
-- - photography_package_bookings (photographer_id field)
-- - dj_bookings
-- - videography_bookings
-- - drone_bookings
-- - decorator_bookings
-- - makeup_bookings
-- - mehendi_bookings
-- - band_bookings
-- - dancer_bookings
-- - singer_bookings
-- - priest_bookings
-- - water_bookings
-- - rental_bookings
-- - banquet_bookings
-- - anchor_bookings
--
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── CATERING BOOKINGS ───────────────────────────────────────────────────────
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

-- ─── PHOTOGRAPHY PACKAGE BOOKINGS ────────────────────────────────────────────
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

-- ─── DJ BOOKINGS ────────────────────────────────────────────────────────────
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

-- ─── VIDEOGRAPHY BOOKINGS ───────────────────────────────────────────────────
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

-- ─── DRONE BOOKINGS ─────────────────────────────────────────────────────────
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

-- ─── DECORATOR BOOKINGS ─────────────────────────────────────────────────────
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

-- ─── MAKEUP BOOKINGS ────────────────────────────────────────────────────────
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

-- ─── MEHENDI BOOKINGS ───────────────────────────────────────────────────────
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

-- ─── BAND BOOKINGS ──────────────────────────────────────────────────────────
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

-- ─── DANCER BOOKINGS ────────────────────────────────────────────────────────
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

-- ─── SINGER BOOKINGS ────────────────────────────────────────────────────────
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

-- ─── PRIEST BOOKINGS ────────────────────────────────────────────────────────
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

-- ─── WATER SUPPLY BOOKINGS ──────────────────────────────────────────────────
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

-- ─── RENTAL BOOKINGS ────────────────────────────────────────────────────────
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

-- ─── BANQUET BOOKINGS ───────────────────────────────────────────────────────
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

-- ─── ANCHOR BOOKINGS ────────────────────────────────────────────────────────
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

-- ══════════════════════════════════════════════════════════════════════════════
-- End of migration
-- ══════════════════════════════════════════════════════════════════════════════
