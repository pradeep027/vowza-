-- ═════════════════════════════════════════════════════════════════════════════
-- URGENT FIX: Add hero_image_url column to about_us table
-- This column is missing from the database and blocks the entire feature
-- ═════════════════════════════════════════════════════════════════════════════

-- Add the hero_image_url column
ALTER TABLE public.about_us
ADD COLUMN IF NOT EXISTS hero_image_url TEXT;

-- Add documentation comment
COMMENT ON COLUMN public.about_us.hero_image_url IS 'URL to the uploaded hero image displayed in the About Us page (stored in Supabase Storage about-us bucket)';

-- ═════════════════════════════════════════════════════════════════════════════
-- VERIFICATION: Check the column was added
-- ═════════════════════════════════════════════════════════════════════════════
-- Run this query to verify the column exists:
-- SELECT column_name FROM information_schema.columns WHERE table_name='about_us' AND column_name='hero_image_url';
-- Should return: hero_image_url
