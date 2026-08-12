-- Create dancer-media storage bucket
INSERT INTO storage.buckets(id, name, public) VALUES('dancer-media', 'dancer-media', true) ON CONFLICT(id) DO NOTHING;

-- Storage policies for dancer media
DROP POLICY IF EXISTS dancer_media_read ON storage.objects;
CREATE POLICY dancer_media_read ON storage.objects FOR SELECT USING (bucket_id = 'dancer-media');

DROP POLICY IF EXISTS dancer_media_owner ON storage.objects;
CREATE POLICY dancer_media_owner ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'dancer-media' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'dancer-media' AND auth.uid()::text = (storage.foldername(name))[1]);
