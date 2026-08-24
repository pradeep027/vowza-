-- ============================================================
-- AI Conversations: Pin / Archive support
-- Adds is_pinned and is_archived to ai_conversations so the
-- ChatGPT-style sidebar can group Pinned / Recent / Archived.
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Index to support sidebar queries filtered by pin/archive state,
-- ordered by recency.
CREATE INDEX IF NOT EXISTS idx_ai_conversations_pinned
  ON public.ai_conversations (user_id, is_pinned, last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_archived
  ON public.ai_conversations (user_id, is_archived, last_active_at DESC);
