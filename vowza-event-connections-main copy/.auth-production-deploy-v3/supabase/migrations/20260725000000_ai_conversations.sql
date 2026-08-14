-- ============================================================
-- VEDA AI: Conversation & Message Persistence
-- Creates two tables:
--   ai_conversations  — one row per conversation thread
--   ai_messages       — one row per message in a thread
-- Both use RLS: users can only see their own rows.
-- Unauthenticated users have no access.
-- ============================================================

-- ─── ai_conversations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'New Conversation',
  -- Serialised PlannerContext (budget, city, event type, etc.)
  context_summary JSONB DEFAULT '{}',
  -- ISO-8601 string — updated every time a message is added
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for loading a user's conversation list ordered by recency
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_active
  ON public.ai_conversations (user_id, last_active_at DESC);

-- ─── ai_messages ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  -- Full AIResponse JSON (budget plan, timeline, etc.) — nullable for user msgs
  ai_response     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for loading messages in a conversation ordered by time
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv_created
  ON public.ai_messages (conversation_id, created_at ASC);

-- Index for fast cascade cleanup
CREATE INDEX IF NOT EXISTS idx_ai_messages_user
  ON public.ai_messages (user_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages      ENABLE ROW LEVEL SECURITY;

-- Conversations: owner-only CRUD
DROP POLICY IF EXISTS "ai_conversations_select" ON public.ai_conversations;
CREATE POLICY "ai_conversations_select" ON public.ai_conversations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conversations_insert" ON public.ai_conversations;
CREATE POLICY "ai_conversations_insert" ON public.ai_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conversations_update" ON public.ai_conversations;
CREATE POLICY "ai_conversations_update" ON public.ai_conversations
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conversations_delete" ON public.ai_conversations;
CREATE POLICY "ai_conversations_delete" ON public.ai_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- Messages: owner-only CRUD
DROP POLICY IF EXISTS "ai_messages_select" ON public.ai_messages;
CREATE POLICY "ai_messages_select" ON public.ai_messages
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_messages_insert" ON public.ai_messages;
CREATE POLICY "ai_messages_insert" ON public.ai_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_messages_update" ON public.ai_messages;
CREATE POLICY "ai_messages_update" ON public.ai_messages
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_messages_delete" ON public.ai_messages;
CREATE POLICY "ai_messages_delete" ON public.ai_messages
  FOR DELETE USING (auth.uid() = user_id);
