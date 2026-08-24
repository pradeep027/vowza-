-- ════════════════════════════════════════════════════════════════════════════════
-- IMMEDIATE FIX: APPLY SELF-BOOKING PREVENTION TO SUPABASE DATABASE
-- ════════════════════════════════════════════════════════════════════════════════
--
-- This script IMMEDIATELY blocks vendors from booking their own packages.
-- Run this in Supabase SQL Editor:
-- 1. Go to https://supabase.com/dashboard
-- 2. Select your project (vowza-event-connections-main)
-- 3. Click "SQL Editor"
-- 4. Paste this entire script
-- 5. Click "Run"
--
-- All existing RLS policies will be REPLACED with self-booking prevention.
-- ════════════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION - Run this after applying above policies:
-- ════════════════════════════════════════════════════════════════════════════════
-- SELECT schemaname, tablename, policyname 
-- FROM pg_policies 
-- WHERE tablename LIKE '%_bookings' AND policyname LIKE '%customer_insert'
-- ORDER BY tablename;
--
-- Expected result: 16 rows (one for each booking table)
-- ════════════════════════════════════════════════════════════════════════════════
