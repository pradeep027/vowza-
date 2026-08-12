-- ============================================================
-- Vowza Chat WhatsApp-like Upgrade
-- Adds: message types (text/image/video/file/location), delivery states,
-- media attachment fields, location coordinates
-- Backward compatible: existing text messages continue to work (defaults to 'text')
-- ============================================================

-- Message type: text, image, video, file, location
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
  CHECK (message_type IN ('text', 'image', 'video', 'file', 'location'));

-- Attachment fields (for image/video/file)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Location fields
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS location_label TEXT;

-- Delivery states (timestamps — null means not yet delivered/read)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Reply reference (for quote/reply feature)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id UUID;

-- Index for delivery tracking
CREATE INDEX IF NOT EXISTS idx_messages_delivered ON public.messages(delivered_at) WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_read ON public.messages(read_at) WHERE read_at IS NULL;

-- ============================================================
-- Storage bucket for chat media
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  false,
  52428800, -- 50MB max
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only authenticated users can upload to their own folder
CREATE POLICY "chat_media_upload" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-media' AND auth.uid() IS NOT NULL
);

-- Storage RLS: participants can read chat media for their bookings
CREATE POLICY "chat_media_read" ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-media' AND auth.uid() IS NOT NULL
);

-- Storage RLS: sender can delete their own uploads
CREATE POLICY "chat_media_delete" ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text
);
