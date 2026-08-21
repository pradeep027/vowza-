-- Photography & Videography Package Builder - Schema Fixes
-- Timestamp: 20261001000000 (October 1, 2026)
-- Safe to apply after: 20260929000000

-- ═════════════════════════════════════════════════════════════════════════════════
-- 1. ADD MISSING COLUMNS TO photography_videography_packages
-- ═════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.photography_videography_packages
ADD COLUMN IF NOT EXISTS advance_percentage NUMERIC(3,1) DEFAULT 20 CHECK (advance_percentage >= 0 AND advance_percentage <= 100);

ALTER TABLE public.photography_videography_packages
ADD COLUMN IF NOT EXISTS event_type TEXT;

COMMENT ON COLUMN public.photography_videography_packages.advance_percentage IS 'Advance percentage required (0-100), default 20%';
COMMENT ON COLUMN public.photography_videography_packages.event_type IS 'Event type: Wedding, Engagement, etc.';

-- ═════════════════════════════════════════════════════════════════════════════════
-- 2. UPDATE photography_videography_package_images TO SUPPORT VIDEO
-- ═════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.photography_videography_package_images
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image', 'video'));

ALTER TABLE public.photography_videography_package_images
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

ALTER TABLE public.photography_videography_package_images
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

COMMENT ON COLUMN public.photography_videography_package_images.media_type IS 'Type of media: image or video';
COMMENT ON COLUMN public.photography_videography_package_images.duration_seconds IS 'Duration for videos in seconds';
COMMENT ON COLUMN public.photography_videography_package_images.thumbnail_url IS 'Thumbnail URL for videos';

-- ═════════════════════════════════════════════════════════════════════════════════
-- 3. CREATE RLS POLICIES FOR photography_videography_packages
-- ═════════════════════════════════════════════════════════════════════════════════

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS photography_videography_vendor_insert ON public.photography_videography_packages CASCADE;
DROP POLICY IF EXISTS photography_videography_vendor_update ON public.photography_videography_packages CASCADE;
DROP POLICY IF EXISTS photography_videography_vendor_delete ON public.photography_videography_packages CASCADE;
DROP POLICY IF EXISTS photography_videography_vendor_select ON public.photography_videography_packages CASCADE;
DROP POLICY IF EXISTS photography_videography_customer_select ON public.photography_videography_packages CASCADE;

-- Vendors can only create/update their own packages
CREATE POLICY photography_videography_vendor_insert 
  ON public.photography_videography_packages 
  FOR INSERT 
  WITH CHECK (provider_id = auth.uid());

CREATE POLICY photography_videography_vendor_update 
  ON public.photography_videography_packages 
  FOR UPDATE 
  USING (provider_id = auth.uid())
  WITH CHECK (provider_id = auth.uid());

CREATE POLICY photography_videography_vendor_delete 
  ON public.photography_videography_packages 
  FOR DELETE 
  USING (provider_id = auth.uid());

CREATE POLICY photography_videography_vendor_select 
  ON public.photography_videography_packages 
  FOR SELECT 
  USING (provider_id = auth.uid());

-- Customers can view active packages
CREATE POLICY photography_videography_customer_select 
  ON public.photography_videography_packages 
  FOR SELECT 
  USING (is_active = TRUE AND is_visible = TRUE AND status IN ('active', 'draft'));

-- ═════════════════════════════════════════════════════════════════════════════════
-- 4. CREATE RLS POLICIES FOR photography_videography_package_images
-- ═════════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS photography_videography_images_vendor ON public.photography_videography_package_images CASCADE;
DROP POLICY IF EXISTS photography_videography_images_customer ON public.photography_videography_package_images CASCADE;

-- Vendors can manage their own package images
CREATE POLICY photography_videography_images_vendor 
  ON public.photography_videography_package_images 
  FOR ALL 
  USING (
    package_id IN (
      SELECT id FROM public.photography_videography_packages 
      WHERE provider_id = auth.uid()
    )
  )
  WITH CHECK (
    package_id IN (
      SELECT id FROM public.photography_videography_packages 
      WHERE provider_id = auth.uid()
    )
  );

-- Customers can view images for active packages
CREATE POLICY photography_videography_images_customer 
  ON public.photography_videography_package_images 
  FOR SELECT 
  USING (
    package_id IN (
      SELECT id FROM public.photography_videography_packages 
      WHERE is_active = TRUE AND is_visible = TRUE AND status IN ('active', 'draft')
    )
  );

-- ═════════════════════════════════════════════════════════════════════════════════
-- 5. CREATE RLS POLICIES FOR photography_videography_package_addons
-- ═════════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS photography_videography_addons_vendor ON public.photography_videography_package_addons CASCADE;
DROP POLICY IF EXISTS photography_videography_addons_customer ON public.photography_videography_package_addons CASCADE;

-- Vendors can manage their own package add-ons
CREATE POLICY photography_videography_addons_vendor 
  ON public.photography_videography_package_addons 
  FOR ALL 
  USING (
    package_id IN (
      SELECT id FROM public.photography_videography_packages 
      WHERE provider_id = auth.uid()
    )
  )
  WITH CHECK (
    package_id IN (
      SELECT id FROM public.photography_videography_packages 
      WHERE provider_id = auth.uid()
    )
  );

-- Customers can view add-ons for active packages
CREATE POLICY photography_videography_addons_customer 
  ON public.photography_videography_package_addons 
  FOR SELECT 
  USING (
    is_active = TRUE AND 
    package_id IN (
      SELECT id FROM public.photography_videography_packages 
      WHERE is_active = TRUE AND is_visible = TRUE AND status IN ('active', 'draft')
    )
  );

-- ═════════════════════════════════════════════════════════════════════════════════
-- 6. CREATE RLS POLICIES FOR photography_videography_package_bookings
-- ═════════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS photography_videography_bookings_vendor ON public.photography_videography_package_bookings CASCADE;
DROP POLICY IF EXISTS photography_videography_bookings_customer ON public.photography_videography_package_bookings CASCADE;
DROP POLICY IF EXISTS photography_videography_bookings_insert ON public.photography_videography_package_bookings CASCADE;

-- Vendors can view their own bookings
CREATE POLICY photography_videography_bookings_vendor 
  ON public.photography_videography_package_bookings 
  FOR SELECT 
  USING (provider_id = auth.uid());

-- Customers can view their own bookings
CREATE POLICY photography_videography_bookings_customer 
  ON public.photography_videography_package_bookings 
  FOR SELECT 
  USING (customer_id = auth.uid());

-- Customers can create bookings
CREATE POLICY photography_videography_bookings_insert 
  ON public.photography_videography_package_bookings 
  FOR INSERT 
  WITH CHECK (customer_id = auth.uid());

-- ═════════════════════════════════════════════════════════════════════════════════
-- 7. CREATE STORAGE BUCKET POLICIES
-- ═════════════════════════════════════════════════════════════════════════════════

-- Drop existing policies if they exist
DROP POLICY IF EXISTS photography_videography_storage_read ON storage.objects CASCADE;
DROP POLICY IF EXISTS photography_videography_storage_upload ON storage.objects CASCADE;
DROP POLICY IF EXISTS photography_videography_storage_update ON storage.objects CASCADE;
DROP POLICY IF EXISTS photography_videography_storage_delete ON storage.objects CASCADE;

-- Read policy: Anyone can read public images/videos
CREATE POLICY photography_videography_storage_read 
  ON storage.objects 
  FOR SELECT 
  USING (bucket_id = 'photography-videography-package-images');

-- Upload policy: Authenticated vendors can upload
CREATE POLICY photography_videography_storage_upload 
  ON storage.objects 
  FOR INSERT 
  WITH CHECK (
    bucket_id = 'photography-videography-package-images' AND
    auth.role() = 'authenticated'
  );

-- Update policy: Vendors can update their own files
CREATE POLICY photography_videography_storage_update 
  ON storage.objects 
  FOR UPDATE 
  USING (
    bucket_id = 'photography-videography-package-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'photography-videography-package-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete policy: Vendors can delete their own files
CREATE POLICY photography_videography_storage_delete 
  ON storage.objects 
  FOR DELETE 
  USING (
    bucket_id = 'photography-videography-package-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ═════════════════════════════════════════════════════════════════════════════════
-- 8. ADD CONSTRAINT ON ADD-ON NAME LENGTH
-- ═════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.photography_videography_package_addons
DROP CONSTRAINT IF EXISTS addon_name_length;

ALTER TABLE public.photography_videography_package_addons
ADD CONSTRAINT addon_name_length CHECK (char_length(trim(name)) BETWEEN 2 AND 100);

-- ═════════════════════════════════════════════════════════════════════════════════
-- 9. CREATE INDEX FOR BETTER QUERY PERFORMANCE
-- ═════════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS photography_videography_packages_active_idx 
  ON public.photography_videography_packages(is_active, is_visible, status) 
  WHERE is_active = TRUE AND is_visible = TRUE;

CREATE INDEX IF NOT EXISTS photography_videography_bookings_customer_idx 
  ON public.photography_videography_package_bookings(customer_id, created_at DESC);

-- ═════════════════════════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═════════════════════════════════════════════════════════════════════════════════

-- This migration:
-- 1. Adds advance_percentage and event_type columns
-- 2. Adds media_type, duration_seconds, thumbnail_url for video support
-- 3. Creates/replaces 14 RLS policies (idempotent with DROP IF EXISTS)
-- 4. Creates 4 storage bucket policies
-- 5. Adds constraints and indexes
-- 6. Safe for reapplication (uses DROP IF EXISTS + ADD IF NOT EXISTS)
