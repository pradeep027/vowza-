-- Create storage buckets for file uploads

-- Profile pictures bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Portfolio bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio', 'portfolio', true)
ON CONFLICT (id) DO NOTHING;

-- Verification documents bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-documents', 'verification-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Cover banners bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('cover-banners', 'cover-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for profile-pictures
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

-- Create storage policies for portfolio
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

-- Create storage policies for verification documents
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

-- Create storage policies for cover-banners
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
