-- ============================================================
-- PHASE 1: Event State Layer (Vowza AI Planner)
--
-- Creates two tables:
--   event_states          — one canonical Event State per conversation
--                           thread (0..1 per ai_conversations row, UNIQUE).
--   event_state_versions  — append-only snapshot history for audit/undo.
--
-- Design rules (from the approved Phase 1 architecture):
--   * ai_conversations remains the thread anchor. event_states hangs off it
--     with ON DELETE CASCADE so conversation deletion cleans up automatically
--     and no new cleanup path is introduced.
--   * state JSONB holds the canonical EventState document produced by
--     src/lib/eventState.ts. The DB stores it opaquely — validation and
--     merging live in application code so the schema never blocks iteration.
--   * RLS mirrors ai_conversations: owner-only CRUD via auth.uid().
--   * Privileges follow the 2026-12-01 hardening posture: anon has no
--     access, authenticated CRUD is guarded by RLS, service_role unchanged.
-- ============================================================

-- ─── event_states ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_states (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Canonical EventState document (see src/lib/eventState.ts)
  state           JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Monotonic version, bumped only when the state actually changes
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_states_conversation
  ON public.event_states (conversation_id);

CREATE INDEX IF NOT EXISTS idx_event_states_user
  ON public.event_states (user_id);

-- ─── event_state_versions (append-only snapshots) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_state_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_state_id  UUID NOT NULL REFERENCES public.event_states(id) ON DELETE CASCADE,
  -- Denormalised for cheap per-user cleanup and future analytics
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  state           JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_state_versions_state
  ON public.event_state_versions (event_state_id, version DESC);

-- ─── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_event_states_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_states_updated_at ON public.event_states;
CREATE TRIGGER trg_event_states_updated_at
  BEFORE UPDATE ON public.event_states
  FOR EACH ROW EXECUTE FUNCTION public.set_event_states_updated_at();

-- ─── Row Level Security (owner-only, mirrors ai_conversations) ────────────────
ALTER TABLE public.event_states         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_state_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_states_select" ON public.event_states;
CREATE POLICY "event_states_select" ON public.event_states
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_states_insert" ON public.event_states;
CREATE POLICY "event_states_insert" ON public.event_states
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_states_update" ON public.event_states;
CREATE POLICY "event_states_update" ON public.event_states
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_states_delete" ON public.event_states;
CREATE POLICY "event_states_delete" ON public.event_states
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_state_versions_select" ON public.event_state_versions;
CREATE POLICY "event_state_versions_select" ON public.event_state_versions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_state_versions_insert" ON public.event_state_versions;
CREATE POLICY "event_state_versions_insert" ON public.event_state_versions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_state_versions_update" ON public.event_state_versions;
CREATE POLICY "event_state_versions_update" ON public.event_state_versions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_state_versions_delete" ON public.event_state_versions;
CREATE POLICY "event_state_versions_delete" ON public.event_state_versions
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Cross-user attach hardening ─────────────────────────────────────────────
-- FKs ignore RLS, so without this a user who somehow learned another user's
-- conversation UUID could insert an event_states row (their own user_id)
-- referencing that conversation. The composite FK enforces that the referenced
-- conversation belongs to the SAME user, closing the vector entirely.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_conversations_id_user
  ON public.ai_conversations (id, user_id);

-- event_states.conversation_id must reference a conversation owned by the
-- same user_id on the state row.
ALTER TABLE public.event_states DROP CONSTRAINT IF EXISTS event_states_conv_owner_fk;
ALTER TABLE public.event_states
  ADD CONSTRAINT event_states_conv_owner_fk
  FOREIGN KEY (conversation_id, user_id)
  REFERENCES public.ai_conversations (id, user_id)
  ON DELETE CASCADE;

-- event_state_versions: the parent event_states row must belong to the same
-- user as the version row (denormalised user_id must match).
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_states_id_user
  ON public.event_states (id, user_id);
ALTER TABLE public.event_state_versions DROP CONSTRAINT IF EXISTS event_state_versions_state_owner_fk;
ALTER TABLE public.event_state_versions
  ADD CONSTRAINT event_state_versions_state_owner_fk
  FOREIGN KEY (event_state_id, user_id)
  REFERENCES public.event_states (id, user_id)
  ON DELETE CASCADE;

-- ─── Privileges (hardening posture: anon gets nothing, authenticated CRUD) ────
REVOKE ALL ON public.event_states         FROM anon;
REVOKE ALL ON public.event_state_versions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_states         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_state_versions TO authenticated;
-- service_role retains its baseline full access for background jobs.
