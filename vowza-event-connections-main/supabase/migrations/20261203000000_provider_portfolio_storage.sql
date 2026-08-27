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

-- KYC and chat media are private by control-plane metadata, not only by
-- object policies. Fail closed if the expected buckets are absent so a
-- partially configured deployment cannot silently continue.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'verification-documents') THEN
    RAISE EXCEPTION 'Missing required private bucket: verification-documents';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-media') THEN
    RAISE EXCEPTION 'Missing required private bucket: chat-media';
  END IF;
  UPDATE storage.buckets
  SET public = false
  WHERE id IN ('verification-documents', 'chat-media');
END $$;

DROP POLICY IF EXISTS "Chat participants can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Participants can read chat files" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_upload" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_read" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_delete" ON storage.objects;

-- The chat path is <sender-user-id>/<booking-id>/<object-name>. Reuse the
-- existing SECURITY DEFINER participant helper, but make its function ACL
-- explicit because it is evaluated from a storage policy.
REVOKE ALL ON FUNCTION public.is_chat_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_chat_participant(uuid, uuid) TO authenticated;

CREATE POLICY "chat_media_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  AND public.is_chat_participant(((storage.foldername(name))[2])::uuid, auth.uid())
);

CREATE POLICY "chat_media_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
      AND public.is_chat_participant(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  )
);

CREATE POLICY "chat_media_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Public downloads are provided only by the provider-portfolio bucket's
-- public flag. Verification and chat buckets remain private and have no
-- anonymous SELECT policy. These policies govern authenticated portfolio
-- object management and require user_id as path segment 1.
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
