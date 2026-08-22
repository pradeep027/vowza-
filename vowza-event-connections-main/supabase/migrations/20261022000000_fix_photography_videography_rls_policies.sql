-- FIX: Photography & Videography RLS Policies Authorization Bug
-- Timestamp: 20261022000000 (October 22, 2026)
-- Fixes the RLS policy mismatch between provider_profiles.id and auth.uid()
--
-- BUG: Previous migration used `provider_id = auth.uid()` which compared:
--   provider_profiles.id (UUID) = auth.users.id (UUID)
-- But these are DIFFERENT UUIDs because provider_profiles.user_id references auth.users.id
--
-- FIX: Use subquery to correctly link:
--   provider_profiles.id IN (SELECT id FROM provider_profiles WHERE user_id = auth.uid())

-- ═════════════════════════════════════════════════════════════════════════════════
-- 1. DROP AND RECREATE photography_videography_packages POLICIES
-- ═════════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS photography_videography_vendor_insert ON public.photography_videography_packages CASCADE;
DROP POLICY IF EXISTS photography_videography_vendor_update ON public.photography_videography_packages CASCADE;
DROP POLICY IF EXISTS photography_videography_vendor_delete ON public.photography_videography_packages CASCADE;
DROP POLICY IF EXISTS photography_videography_vendor_select ON public.photography_videography_packages CASCADE;

-- Vendors can only create/update/delete/view their own packages
CREATE POLICY photography_videography_vendor_insert 
  ON public.photography_videography_packages 
  FOR INSERT 
  WITH CHECK (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY photography_videography_vendor_update 
  ON public.photography_videography_packages 
  FOR UPDATE 
  USING (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY photography_videography_vendor_delete 
  ON public.photography_videography_packages 
  FOR DELETE 
  USING (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY photography_videography_vendor_select 
  ON public.photography_videography_packages 
  FOR SELECT 
  USING (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
  );

-- ═════════════════════════════════════════════════════════════════════════════════
-- 2. DROP AND RECREATE photography_videography_package_images POLICIES
-- ═════════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS photography_videography_images_vendor ON public.photography_videography_package_images CASCADE;

-- Vendors can manage their own package images (create, read, update, delete)
CREATE POLICY photography_videography_images_vendor 
  ON public.photography_videography_package_images 
  FOR ALL 
  USING (
    package_id IN (
      SELECT id FROM public.photography_videography_packages 
      WHERE provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    package_id IN (
      SELECT id FROM public.photography_videography_packages 
      WHERE provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
    )
  );

-- ═════════════════════════════════════════════════════════════════════════════════
-- 3. DROP AND RECREATE photography_videography_package_addons POLICIES
-- ═════════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS photography_videography_addons_vendor ON public.photography_videography_package_addons CASCADE;

-- Vendors can manage their own package add-ons
CREATE POLICY photography_videography_addons_vendor 
  ON public.photography_videography_package_addons 
  FOR ALL 
  USING (
    package_id IN (
      SELECT id FROM public.photography_videography_packages 
      WHERE provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    package_id IN (
      SELECT id FROM public.photography_videography_packages 
      WHERE provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
    )
  );

-- ═════════════════════════════════════════════════════════════════════════════════
-- 4. DROP AND RECREATE photography_videography_package_bookings POLICIES
-- ═════════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS photography_videography_bookings_vendor ON public.photography_videography_package_bookings CASCADE;

-- Vendors can view their own bookings
CREATE POLICY photography_videography_bookings_vendor 
  ON public.photography_videography_package_bookings 
  FOR SELECT 
  USING (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
  );

-- ═════════════════════════════════════════════════════════════════════════════════
-- END: RLS POLICY FIX
-- ═════════════════════════════════════════════════════════════════════════════════
