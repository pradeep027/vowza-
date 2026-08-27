CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('verification-documents', 'verification-documents', true),
  ('chat-media', 'chat-media', false),
  ('chat-files', 'chat-files', false),
  ('provider-media', 'provider-media', true)
ON CONFLICT (id) DO NOTHING;

GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.buckets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO service_role;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO anon, authenticated, service_role;
