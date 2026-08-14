-- Add media_type to anchor_gallery if missing, create storage bucket
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='anchor_gallery' AND column_name='media_type') THEN
    ALTER TABLE public.anchor_gallery ADD COLUMN media_type text NOT NULL DEFAULT 'image';
  END IF;
END $$;

-- Storage bucket for anchor media
INSERT INTO storage.buckets(id,name,public) VALUES('anchor-media','anchor-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS anchor_media_read ON storage.objects;
DROP POLICY IF EXISTS anchor_media_owner ON storage.objects;
CREATE POLICY anchor_media_read ON storage.objects FOR SELECT USING(bucket_id='anchor-media');
CREATE POLICY anchor_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='anchor-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='anchor-media' AND auth.uid()::text=(storage.foldername(name))[1]);
