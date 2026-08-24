-- ============================================
-- PRODUCTION STORAGE SETUP
-- Complete storage configuration for Vowza platform
-- ============================================

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public read access for profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile pictures" ON storage.objects;

DROP POLICY IF EXISTS "Public read access for portfolio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload portfolio items" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own portfolio items" ON storage.objects;

DROP POLICY IF EXISTS "Admins can read verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own verification documents" ON storage.objects;

DROP POLICY IF EXISTS "Public read access for cover banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload cover banners" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own cover banners" ON storage.objects;

-- ============================================
-- CREATE ALL REQUIRED STORAGE BUCKETS
-- ============================================

-- Artist profile images
INSERT INTO storage.buckets (id, name, public)
VALUES ('artist-profile-images', 'artist-profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- Customer profile images
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-profile-images', 'customer-profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- Portfolio images
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio-images', 'portfolio-images', true)
ON CONFLICT (id) DO NOTHING;

-- Business documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-documents', 'business-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Verification documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-documents', 'verification-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Gallery
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

-- Videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Contracts
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Event images
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Profile pictures (legacy - keep for compatibility)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Portfolio (legacy - keep for compatibility)
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio', 'portfolio', true)
ON CONFLICT (id) DO NOTHING;

-- Cover banners (legacy - keep for compatibility)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cover-banners', 'cover-banners', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES - ARTIST PROFILE IMAGES
-- ============================================

CREATE POLICY "Public read access for artist profile images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'artist-profile-images');

CREATE POLICY "Authenticated artists can upload profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'artist-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Artists can update their own profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'artist-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Artists can delete their own profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'artist-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- STORAGE POLICIES - CUSTOMER PROFILE IMAGES
-- ============================================

CREATE POLICY "Public read access for customer profile images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'customer-profile-images');

CREATE POLICY "Authenticated customers can upload profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'customer-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Customers can update their own profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'customer-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Customers can delete their own profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'customer-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- STORAGE POLICIES - PORTFOLIO IMAGES
-- ============================================

CREATE POLICY "Public read access for portfolio images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'portfolio-images');

CREATE POLICY "Authenticated artists can upload portfolio images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'portfolio-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Artists can update their own portfolio images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'portfolio-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Artists can delete their own portfolio images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'portfolio-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- STORAGE POLICIES - BUSINESS DOCUMENTS
-- ============================================

CREATE POLICY "Admins can read business documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'business-documents' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can upload their own business documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'business-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own business documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'business-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own business documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'business-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- STORAGE POLICIES - VERIFICATION DOCUMENTS
-- ============================================

CREATE POLICY "Admins can read verification documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can upload their own verification documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own verification documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'verification-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own verification documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'verification-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- STORAGE POLICIES - GALLERY
-- ============================================

CREATE POLICY "Public read access for gallery"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'gallery');

CREATE POLICY "Authenticated artists can upload to gallery"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Artists can update their own gallery items"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Artists can delete their own gallery items"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- STORAGE POLICIES - VIDEOS
-- ============================================

CREATE POLICY "Public read access for videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'videos');

CREATE POLICY "Authenticated artists can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Artists can update their own videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Artists can delete their own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- STORAGE POLICIES - CONTRACTS
-- ============================================

CREATE POLICY "Admins can read contracts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contracts' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can read their own contracts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contracts' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can upload contracts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contracts' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- STORAGE POLICIES - EVENT IMAGES
-- ============================================

CREATE POLICY "Public read access for event images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'event-images');

CREATE POLICY "Authenticated users can upload event images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own event images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own event images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- STORAGE POLICIES - THUMBNAILS
-- ============================================

CREATE POLICY "Public read access for thumbnails"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'thumbnails');

CREATE POLICY "Authenticated users can upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- LEGACY STORAGE POLICIES (for compatibility)
-- ============================================

CREATE POLICY "Public read access for profile pictures"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');

CREATE POLICY "Authenticated users can upload profile pictures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own profile pictures"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read access for portfolio"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'portfolio');

CREATE POLICY "Authenticated users can upload portfolio items"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own portfolio items"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read access for cover banners"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'cover-banners');

CREATE POLICY "Authenticated users can upload cover banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cover-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own cover banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'cover-banners' AND auth.uid()::text = (storage.foldername(name))[1]);
