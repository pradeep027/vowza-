-- ─── CRITICAL FIX: Add hero_image_url column and Storage bucket ────────────
-- This migration adds the missing hero_image_url column and creates the
-- about-us storage bucket with proper public access
-- Date: 2026-11-25

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. ADD hero_image_url COLUMN TO about_us TABLE
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.about_us
ADD COLUMN IF NOT EXISTS hero_image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.about_us.hero_image_url IS 'URL to the uploaded hero image displayed in the About Us page (stored in Supabase Storage about-us bucket)';

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. CREATE STORAGE BUCKET: about-us
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'about-us',
  'about-us',
  TRUE,
  TRUE,
  5242880,  -- 5MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. RLS POLICIES FOR STORAGE: about-us bucket
-- ═════════════════════════════════════════════════════════════════════════════

-- Drop existing policies if they exist (safely)
DROP POLICY IF EXISTS "about-us-public-read" ON storage.objects;
DROP POLICY IF EXISTS "about-us-admin-upload" ON storage.objects;
DROP POLICY IF EXISTS "about-us-admin-delete" ON storage.objects;

-- Storage: Public read access to all about-us photos
CREATE POLICY "about-us-public-read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'about-us');

-- Storage: Admin can upload
CREATE POLICY "about-us-admin-upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'about-us'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Storage: Admin can delete
CREATE POLICY "about-us-admin-delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'about-us'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ═════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═════════════════════════════════════════════════════════════════════════════
-- Migration Status:
-- ✓ hero_image_url column added to about_us table
-- ✓ about-us storage bucket created (public)
-- ✓ RLS policies configured for public read, admin write/delete
