-- Add additional fields to provider_profiles for enhanced onboarding
ALTER TABLE public.provider_profiles 
ADD COLUMN IF NOT EXISTS stage_name TEXT,
ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS pricing_type TEXT DEFAULT 'per_event',
ADD COLUMN IF NOT EXISTS category_details JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS performance_type TEXT,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Add state column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS state TEXT;

-- Create storage bucket for provider media (ignore if exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('provider-media', 'provider-media', true, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (drop if exist then recreate)
DROP POLICY IF EXISTS "Anyone can view provider media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload provider media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own provider media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own provider media" ON storage.objects;

CREATE POLICY "Anyone can view provider media"
ON storage.objects FOR SELECT
USING (bucket_id = 'provider-media');

CREATE POLICY "Authenticated users can upload provider media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'provider-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own provider media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'provider-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own provider media"
ON storage.objects FOR DELETE
USING (bucket_id = 'provider-media' AND auth.uid()::text = (storage.foldername(name))[1]);