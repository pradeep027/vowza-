-- ============================================================
-- AI Conversations: Favorite support
-- Adds is_favorite to ai_conversations for the ChatGPT-style
-- "Favorite Conversations" feature.
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_favorite
  ON public.ai_conversations (user_id, is_favorite, last_active_at DESC);
