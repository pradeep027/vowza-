-- Local/staging-only assertions for chat-media security.
-- Run after the storage migration in a disposable replay or staging database.
-- No production data is selected or modified.

DO $$
DECLARE
  definition text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-media' AND public = false) THEN
    RAISE EXCEPTION 'chat-media must remain private';
  END IF;

  IF has_table_privilege('anon', 'storage.objects', 'SELECT') THEN
    RAISE EXCEPTION 'anon must not have storage.objects SELECT privilege';
  END IF;

  SELECT pg_get_expr(polqual, polrelid)
    INTO definition
  FROM pg_policy
  WHERE polname = 'chat_media_read'
    AND polrelid = 'storage.objects'::regclass;
  IF definition IS NULL OR definition NOT LIKE '%is_chat_participant%' THEN
    RAISE EXCEPTION 'chat_media_read must enforce booking participation';
  END IF;

  SELECT pg_get_expr(polwithcheck, polrelid)
    INTO definition
  FROM pg_policy
  WHERE polname = 'chat_media_upload'
    AND polrelid = 'storage.objects'::regclass;
  IF definition IS NULL OR definition NOT LIKE '%is_chat_participant%' THEN
    RAISE EXCEPTION 'chat_media_upload must enforce booking participation';
  END IF;
END $$;
