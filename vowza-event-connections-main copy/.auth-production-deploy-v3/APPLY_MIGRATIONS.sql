-- ============================================
-- RUN THIS SQL IN YOUR SUPABASE DASHBOARD
-- ============================================
-- Go to: https://supabase.com/dashboard
-- Select your project
-- Go to SQL Editor
-- Copy and paste this entire script
-- Click "Run"

-- 1. Add state and organization_name columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS organization_name TEXT;

-- 2. Add phone_verified column for OTP verification
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- 3. Add index for phone_verified queries
CREATE INDEX IF NOT EXISTS idx_profiles_phone_verified ON public.profiles(phone_verified);

-- 4. Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio', 'portfolio', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-documents', 'verification-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('cover-banners', 'cover-banners', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Create storage policies for profile-pictures
DROP POLICY IF EXISTS "Public read access for profile pictures" ON storage.objects;
CREATE POLICY "Public read access for profile pictures"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');

DROP POLICY IF EXISTS "Authenticated users can upload profile pictures" ON storage.objects;
CREATE POLICY "Authenticated users can upload profile pictures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own profile pictures" ON storage.objects;
CREATE POLICY "Users can update their own profile pictures"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 6. Create storage policies for portfolio
DROP POLICY IF EXISTS "Public read access for portfolio" ON storage.objects;
CREATE POLICY "Public read access for portfolio"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'portfolio');

DROP POLICY IF EXISTS "Authenticated users can upload portfolio items" ON storage.objects;
CREATE POLICY "Authenticated users can upload portfolio items"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own portfolio items" ON storage.objects;
CREATE POLICY "Users can update their own portfolio items"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 7. Create storage policies for verification documents
DROP POLICY IF EXISTS "Admins can read verification documents" ON storage.objects;
CREATE POLICY "Admins can read verification documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents' AND
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Users can upload their own verification documents" ON storage.objects;
CREATE POLICY "Users can upload their own verification documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update their own verification documents" ON storage.objects;
CREATE POLICY "Users can update their own verification documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'verification-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 8. Create storage policies for cover-banners
DROP POLICY IF EXISTS "Public read access for cover banners" ON storage.objects;
CREATE POLICY "Public read access for cover banners"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'cover-banners');

DROP POLICY IF EXISTS "Authenticated users can upload cover banners" ON storage.objects;
CREATE POLICY "Authenticated users can upload cover banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cover-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own cover banners" ON storage.objects;
CREATE POLICY "Users can update their own cover banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'cover-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these after the migration to verify everything is set up correctly

-- Check profiles table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check storage buckets exist
SELECT id, name, public 
FROM storage.buckets;

-- Check storage policies exist
SELECT policyname, tablename 
FROM pg_policies 
WHERE schemaname = 'storage';
