-- §8 storage remediation, step 2.
-- Step 1 (making provider-media private) is intentionally external to this migration.
-- This migration creates the public portfolio destination used by new source uploads.
-- Step 4 is a separate one-time Edge Function because object copying requires storage I/O.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'provider-portfolio',
  'provider-portfolio',
  true,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- chat-files was observed empty in production and is not the active chat bucket.
-- Abort rather than delete if any object appears before this migration runs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'chat-files') THEN
    RAISE EXCEPTION 'Refusing to drop chat-files: bucket contains objects';
  END IF;
  DELETE FROM storage.buckets WHERE id = 'chat-files';
END $$;

DROP POLICY IF EXISTS "Chat participants can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Participants can read chat files" ON storage.objects;

-- Public downloads are provided by the bucket's public flag. These policies
-- govern authenticated object management and require user_id as path segment 1.
DROP POLICY IF EXISTS "provider_portfolio_owner_insert" ON storage.objects;
CREATE POLICY "provider_portfolio_owner_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'provider-portfolio'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "provider_portfolio_owner_update" ON storage.objects;
CREATE POLICY "provider_portfolio_owner_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'provider-portfolio'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'provider-portfolio'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "provider_portfolio_owner_delete" ON storage.objects;
CREATE POLICY "provider_portfolio_owner_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'provider-portfolio'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
