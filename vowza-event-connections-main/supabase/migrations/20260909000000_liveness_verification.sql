-- ============================================================
-- Vowza Face Liveness Verification for Artist Registration
-- Adds verification fields to provider_profiles
-- ============================================================

ALTER TABLE public.provider_profiles ADD COLUMN IF NOT EXISTS liveness_verified BOOLEAN DEFAULT false;
ALTER TABLE public.provider_profiles ADD COLUMN IF NOT EXISTS liveness_verified_at TIMESTAMPTZ;
ALTER TABLE public.provider_profiles ADD COLUMN IF NOT EXISTS liveness_provider TEXT DEFAULT 'mediapipe_face_mesh';
ALTER TABLE public.provider_profiles ADD COLUMN IF NOT EXISTS liveness_session_id TEXT;
ALTER TABLE public.provider_profiles ADD COLUMN IF NOT EXISTS liveness_attempts INTEGER DEFAULT 0;
