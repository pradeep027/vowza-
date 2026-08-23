-- ─── About Us Hero Image Upload Support ───────────────────────────────────
-- Add hero_image_url field to about_us table for admin-uploadable hero images
-- Date: 2026-07-30

-- Add hero_image_url column to about_us table
ALTER TABLE public.about_us
ADD COLUMN IF NOT EXISTS hero_image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.about_us.hero_image_url IS 'URL to the uploaded hero image displayed in the About Us page (stored in Supabase Storage about-us bucket)';

-- Migration Status: ✓ hero_image_url column added to about_us table
--                   ✓ Admin can upload images via AboutVowzaEditor component
--                   ✓ Public About page displays uploaded image or fallback
